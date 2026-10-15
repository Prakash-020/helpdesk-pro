import { Router } from 'express';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import type { AnalyticsOverviewDto } from '@helpdesk/shared';
import { requireStaff, requireAdmin } from '../../middleware/auth';
import { ah } from '../../utils/async-handler';
import { prisma } from '../../utils/prisma';

export const analyticsRouter = Router();
analyticsRouter.use(requireStaff);

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] as const;

/** Role-scoped visibility — agents see their slice, admins see everything. */
function scopeFor(user: NonNullable<Request['user']>): Prisma.TicketWhereInput {
  if (user.role === 'ADMIN') return {};
  return { OR: [{ assigneeId: user.id }, { assigneeId: null }] };
}

/** Same scope as a SQL fragment for raw aggregate queries. */
function scopeSql(user: NonNullable<Request['user']>): Prisma.Sql {
  if (user.role === 'ADMIN') return Prisma.empty;
  return Prisma.sql`AND (assignee_id = ${user.id}::uuid OR assignee_id IS NULL)`;
}

/** GET /analytics/overview — dashboard stat cards. */
analyticsRouter.get(
  '/overview',
  ah(async (req, res) => {
    const user = req.user!;
    const scope = scopeFor(user);
    const now = new Date();

    const grouped = await prisma.ticket.groupBy({
      by: ['status'],
      where: { AND: [{ deletedAt: null }, scope] },
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));

    const overdue = await prisma.ticket.count({
      where: {
        AND: [
          { deletedAt: null },
          scope,
          { status: { in: [...OPEN_STATUSES] } },
          {
            OR: [
              { responseDueAt: { lt: now }, firstResponseAt: null },
              { resolutionDueAt: { lt: now } },
            ],
          },
        ],
      },
    });

    // Averages computed from stored timestamps — no extra columns needed.
    const [avg] = await prisma.$queryRaw<
      [{ first_resp_min: number | null; resolution_min: number | null }]
    >`
      SELECT
        (AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)
          FILTER (WHERE first_response_at IS NOT NULL))::float AS first_resp_min,
        (AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)
          FILTER (WHERE resolved_at IS NOT NULL))::float AS resolution_min
      FROM tickets
      WHERE deleted_at IS NULL ${scopeSql(user)}
    `;

    const dto: AnalyticsOverviewDto = {
      total: grouped.reduce((s, g) => s + g._count._all, 0),
      open: byStatus['OPEN'] ?? 0,
      inProgress: byStatus['IN_PROGRESS'] ?? 0,
      waitingForCustomer: byStatus['WAITING_FOR_CUSTOMER'] ?? 0,
      resolved: byStatus['RESOLVED'] ?? 0,
      closed: byStatus['CLOSED'] ?? 0,
      overdue,
      avgFirstResponseMinutes: avg.first_resp_min,
      avgResolutionMinutes: avg.resolution_min,
    };
    res.json(dto);
  }),
);

/** GET /analytics/tickets?days=30 — volume over time + breakdowns. */
analyticsRouter.get(
  '/tickets',
  ah(async (req, res) => {
    const user = req.user!;
    const scope = scopeFor(user);
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
    const since = new Date(Date.now() - days * 86_400_000);

    const [volume, byStatus, byPriority] = await Promise.all([
      prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COUNT(*)::bigint AS count
        FROM tickets
        WHERE deleted_at IS NULL AND created_at >= ${since} ${scopeSql(user)}
        GROUP BY 1 ORDER BY 1`,
      prisma.ticket.groupBy({
        by: ['status'],
        where: { AND: [{ deletedAt: null }, scope] },
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { AND: [{ deletedAt: null }, scope] },
        _count: { _all: true },
      }),
    ]);

    res.json({
      days,
      volume: volume.map((r) => ({ day: r.day, count: Number(r.count) })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
    });
  }),
);

/** GET /analytics/agents — workload + performance per agent (ADMIN only). */
analyticsRouter.get(
  '/agents',
  requireAdmin,
  ah(async (_req, res) => {
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT', accountStatus: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const rows = await Promise.all(
      agents.map(async (a) => {
        const [assigned, open, resolved, avg] = await prisma.$transaction([
          prisma.ticket.count({ where: { assigneeId: a.id, deletedAt: null } }),
          prisma.ticket.count({
            where: { assigneeId: a.id, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
          }),
          prisma.ticket.count({
            where: { assigneeId: a.id, deletedAt: null, status: { in: ['RESOLVED', 'CLOSED'] } },
          }),
          prisma.$queryRaw<[{ m: number | null }]>`
            SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::float AS m
            FROM tickets
            WHERE deleted_at IS NULL AND resolved_at IS NOT NULL AND assignee_id = ${a.id}::uuid`,
        ]);
        return {
          agent: a,
          assigned,
          open,
          resolved,
          avgResolutionMinutes: avg[0].m,
        };
      }),
    );
    res.json({ data: rows });
  }),
);
