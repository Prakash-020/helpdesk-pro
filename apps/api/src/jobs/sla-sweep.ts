import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { emitDomainEvent } from '../events/bus';
import { notifyUser } from '../modules/notifications/notifications.service';
import { env } from '../config/env';

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] as const;
/** Warn this long before resolution deadline. */
const WARN_WINDOW_MINUTES = 30;

/**
 * Scheduled SLA sweep. Finds live tickets approaching (or past) their
 * resolution deadline that haven't been warned about yet, notifies the
 * assignee (or all agents when unassigned) once, stamps `slaWarningSentAt`
 * so each ticket warns exactly once, and emits `ticket:sla_warning`.
 */
export async function runSlaSweep(now = new Date()) {
  const warnBefore = new Date(now.getTime() + WARN_WINDOW_MINUTES * 60_000);

  const candidates = await prisma.ticket.findMany({
    where: {
      deletedAt: null,
      status: { in: [...OPEN_STATUSES] },
      slaWarningSentAt: null,
      resolutionDueAt: { lt: warnBefore },
    },
    select: { id: true, ticketNumber: true, assigneeId: true, resolutionDueAt: true },
  });
  if (candidates.length === 0) return 0;

  for (const t of candidates) {
    const overdue = t.resolutionDueAt! < now;
    const message = `SLA ${overdue ? 'breached' : 'warning'} — ${t.ticketNumber} ${
      overdue ? 'is past its resolution deadline' : 'is nearing its resolution deadline'
    }`;

    // Mark first so a crash between notify+stamp doesn't double-send.
    await prisma.ticket.update({ where: { id: t.id }, data: { slaWarningSentAt: now } });

    if (t.assigneeId) {
      await notifyUser(t.assigneeId, 'SLA_WARNING', message, t.id);
    } else {
      // Unassigned → page the whole agent pool.
      const agents = await prisma.user.findMany({
        where: { role: 'AGENT', accountStatus: 'ACTIVE' },
        select: { id: true },
      });
      await Promise.all(agents.map((a) => notifyUser(a.id, 'SLA_WARNING', message, t.id)));
    }

    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: 'SLA_WARNING_SENT',
        entityType: 'TICKET',
        entityId: t.id,
        metadata: { overdue, resolutionDueAt: t.resolutionDueAt },
      },
    });

    emitDomainEvent('ticket.updated', { ticketId: t.id });
  }

  if (candidates.length > 0) {
    logger.info({ count: candidates.length }, 'SLA sweep sent warnings');
  }
  return candidates.length;
}

export function startSlaSweeper() {
  const intervalMs = env.SLA_SWEEP_MINUTES * 60_000;
  const timer = setInterval(() => {
    runSlaSweep().catch((e) => logger.error(e, 'SLA sweep failed'));
  }, intervalMs);
  timer.unref();
  // Run once at boot too (catch up after downtime)
  runSlaSweep().catch((e) => logger.error(e, 'initial SLA sweep failed'));
  return timer;
}
