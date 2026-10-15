import { Router } from 'express';
import { z } from 'zod';
import { AUDIT_ACTIONS, ENTITY_TYPES, paginationSchema, type AuditLogDto } from '@helpdesk/shared';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ah } from '../../utils/async-handler';
import { prisma } from '../../utils/prisma';

const querySchema = paginationSchema.extend({
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  entityId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const auditRouter = Router();
auditRouter.use(requireAdmin);

/** Append-only audit trail — ADMIN only, filterable + paginated. */
auditRouter.get(
  '/',
  validate(querySchema, 'query'),
  ah(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof querySchema>;
    const where = {
      ...(q.action ? { action: q.action } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {}),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
    ]);
    const data: AuditLogDto[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.actor ? { id: r.actor.id, name: r.actor.name, role: r.actor.role } : null,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    res.json({ data, page: q.page, pageSize: q.pageSize, total });
  }),
);
