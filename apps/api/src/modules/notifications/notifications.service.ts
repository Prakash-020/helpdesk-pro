import type { Request } from 'express';
import type { Prisma, Notification, Ticket } from '@prisma/client';
import type { NotificationDto, NotificationType, Paginated } from '@helpdesk/shared';
import { paginationSchema } from '@helpdesk/shared';
import { prisma } from '../../utils/prisma';
import { emitDomainEvent } from '../../events/bus';

type AuthUser = NonNullable<Request['user']>;

export function toNotificationDto(
  n: Notification & { ticket?: Pick<Ticket, 'ticketNumber'> | null },
): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    ticketId: n.ticketId,
    ticketNumber: n.ticket?.ticketNumber ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Persisted notification — the durable fallback when sockets are down.
 * Callers: ticket service on assignment/reply/status change.
 */
export async function notifyUser(
  recipientId: string,
  type: NotificationType,
  message: string,
  ticketId?: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  const notification = await db.notification.create({
    data: { recipientId, type, message, ticketId: ticketId ?? null },
    include: { ticket: { select: { ticketNumber: true } } },
  });
  emitDomainEvent('notification.created', { notificationId: notification.id });
  return notification;
}

export async function listMine(user: AuthUser, query: unknown): Promise<Paginated<NotificationDto>> {
  const q = paginationSchema.parse(query);
  const where = { recipientId: user.id };
  const [total, rows] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { ticket: { select: { ticketNumber: true } } },
    }),
  ]);
  return { data: rows.map(toNotificationDto), page: q.page, pageSize: q.pageSize, total };
}

export async function unreadCount(user: AuthUser) {
  const count = await prisma.notification.count({
    where: { recipientId: user.id, readAt: null },
  });
  return { count };
}

export async function markRead(user: AuthUser, id: string) {
  const updated = await prisma.notification.updateMany({
    where: { id, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (updated.count === 0) {
    // idempotent: already-read or foreign → still 200 for own, 404 for foreign
    const exists = await prisma.notification.findFirst({
      where: { id, recipientId: user.id },
    });
    if (!exists) throw (await import('../../utils/errors')).errors.notFound('Notification');
  }
  return { ok: true };
}

export async function markAllRead(user: AuthUser) {
  await prisma.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}
