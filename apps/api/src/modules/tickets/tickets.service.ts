import type { Request } from 'express';
import { Prisma, type Ticket, type User } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  REOPEN_WINDOW_DAYS,
  type AssignTicketInput,
  type CreateCommentInput,
  type CreateTicketInput,
  type Paginated,
  type TicketListQuery,
  type TicketSummaryDto,
  type UpdateStatusInput,
  type UpdateTicketInput,
} from '@helpdesk/shared';
import { prisma } from '../../utils/prisma';
import { errors } from '../../utils/errors';
import { emitDomainEvent } from '../../events/bus';
import { notifyUser } from '../notifications/notifications.service';
import {
  toCommentDto,
  toTicketDto,
  toTicketSummary,
  TICKET_INCLUDE,
} from './serializers';

type AuthUser = NonNullable<Request['user']>;

/* ---------- authorization helpers ---------- */

/** Who may see a ticket at all. */
export function canViewTicket(user: AuthUser, ticket: Pick<Ticket, 'customerId' | 'assigneeId'>) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'CUSTOMER') return ticket.customerId === user.id;
  // AGENT: own assignments + the unassigned pool
  return ticket.assigneeId === null || ticket.assigneeId === user.id;
}

/** Who may act on it (status, assign, edit, internal notes). */
function canOperateTicket(user: AuthUser, ticket: Pick<Ticket, 'customerId' | 'assigneeId'>) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'AGENT') return ticket.assigneeId === null || ticket.assigneeId === user.id;
  return false;
}

async function findTicketOr404(id: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id, deletedAt: null },
    include: TICKET_INCLUDE,
  });
  if (!ticket) throw errors.notFound('Ticket');
  return ticket;
}

async function nextTicketNumber() {
  const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('ticket_number_seq')`;
  return `HD-${String(nextval).padStart(6, '0')}`;
}

/* ---------- list ---------- */

export async function listTickets(
  user: AuthUser,
  q: TicketListQuery,
): Promise<Paginated<TicketSummaryDto>> {
  const now = new Date();

  // Role-scoped visibility — enforced at the query layer, not the UI.
  const scope: Prisma.TicketWhereInput =
    user.role === 'ADMIN'
      ? {}
      : user.role === 'CUSTOMER'
        ? { customerId: user.id }
        : { OR: [{ assigneeId: user.id }, { assigneeId: null }] };

  const where: Prisma.TicketWhereInput = {
    AND: [
      scope,
      { deletedAt: null },
      q.status ? { status: q.status } : {},
      q.priority ? { priority: q.priority } : {},
      q.categoryId ? { categoryId: q.categoryId } : {},
      q.assigneeId ? { assigneeId: q.assigneeId } : {},
      q.assignee === 'me' ? { assigneeId: user.id } : {},
      q.from ? { createdAt: { gte: q.from } } : {},
      q.to ? { createdAt: { lte: q.to } } : {},
      q.search
        ? {
            OR: [
              { subject: { contains: q.search, mode: 'insensitive' } },
              { ticketNumber: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {},
      q.sla === 'breached'
        ? {
            OR: [
              // response SLA missed: first response overdue and never given
              { responseDueAt: { lt: now }, firstResponseAt: null },
              // resolution SLA missed on a live ticket
              { resolutionDueAt: { lt: now }, status: { notIn: ['RESOLVED', 'CLOSED'] } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.TicketOrderByWithRelationInput = { [q.sort]: q.order };

  const [total, rows] = await prisma.$transaction([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: TICKET_INCLUDE,
    }),
  ]);

  return {
    data: rows.map((t) => toTicketSummary(t, now)),
    page: q.page,
    pageSize: q.pageSize,
    total,
  };
}

/* ---------- read ---------- */

export async function getTicket(user: AuthUser, id: string) {
  const ticket = await findTicketOr404(id);
  // 404 (not 403) for out-of-scope tickets — don't confirm existence.
  if (!canViewTicket(user, ticket)) throw errors.notFound('Ticket');
  return toTicketDto(ticket, nowMarker());
}

function nowMarker() {
  return new Date();
}

/* ---------- create ---------- */

export async function createTicket(customer: AuthUser, input: CreateTicketInput) {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, isActive: true },
  });
  if (!category) throw errors.badRequest('Invalid or inactive category');

  const sla = await prisma.slaTarget.findUnique({ where: { priority: input.priority } });
  const ticketNumber = await nextTicketNumber();
  const now = nowMarker();

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        ticketNumber,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        categoryId: category.id,
        customerId: customer.id,
        responseDueAt: sla ? new Date(now.getTime() + sla.firstResponseMinutes * 60_000) : null,
        resolutionDueAt: sla ? new Date(now.getTime() + sla.resolutionMinutes * 60_000) : null,
      },
      include: TICKET_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        actorId: customer.id,
        action: 'TICKET_CREATED',
        entityType: 'TICKET',
        entityId: created.id,
        metadata: { ticketNumber },
      },
    });
    return created;
  });

  emitDomainEvent('ticket.created', { ticketId: ticket.id });
  return toTicketDto(ticket, now);
}

/* ---------- update (staff metadata edit) ---------- */

export async function updateTicket(user: AuthUser, id: string, input: UpdateTicketInput) {
  const ticket = await findTicketOr404(id);
  if (!canOperateTicket(user, ticket)) throw errors.notFound('Ticket');

  const diff: Record<string, { from: string | null; to: string | null }> = {};
  for (const key of ['subject', 'description', 'categoryId', 'priority'] as const) {
    const next = input[key];
    if (next !== undefined && next !== ticket[key]) {
      diff[key] = { from: ticket[key], to: next };
    }
  }
  if (Object.keys(diff).length === 0) return toTicketDto(ticket, nowMarker());

  const data: Prisma.TicketUpdateInput = { ...input };
  // SLA targets are per-priority — re-derive due dates when priority moves.
  if (input.priority && input.priority !== ticket.priority) {
    const sla = await prisma.slaTarget.findUnique({ where: { priority: input.priority } });
    if (sla) {
      if (!ticket.firstResponseAt) {
        data.responseDueAt = new Date(
          ticket.createdAt.getTime() + sla.firstResponseMinutes * 60_000,
        );
      }
      if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
        data.resolutionDueAt = new Date(
          ticket.createdAt.getTime() + sla.resolutionMinutes * 60_000,
        );
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.update({ where: { id }, data, include: TICKET_INCLUDE });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'TICKET_UPDATED',
        entityType: 'TICKET',
        entityId: id,
        metadata: { diff },
      },
    });
    return t;
  });

  emitDomainEvent('ticket.updated', { ticketId: id });
  return toTicketDto(updated, nowMarker());
}

/* ---------- status transitions ---------- */

export async function updateStatus(user: AuthUser, id: string, input: UpdateStatusInput) {
  const ticket = await findTicketOr404(id);
  const from = ticket.status;
  const to = input.status;

  if (from === to) return toTicketDto(ticket, nowMarker());

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw errors.forbiddenTransition(`Cannot move ticket from ${from} to ${to}`);
  }

  if (user.role === 'CUSTOMER') {
    // Customers may only resolve-confirm their own ticket (close) or reopen.
    if (ticket.customerId !== user.id) throw errors.notFound('Ticket');
    const allowed = (from === 'RESOLVED' && to === 'CLOSED') || (from === 'RESOLVED' && to === 'OPEN');
    if (!allowed) throw errors.forbidden('Customers can only close or reopen a resolved ticket');
    if (to === 'OPEN' && ticket.resolvedAt) {
      const reopenedTooLate =
        Date.now() - ticket.resolvedAt.getTime() > REOPEN_WINDOW_DAYS * 86_400_000;
      if (reopenedTooLate) {
        throw errors.forbiddenTransition(
          `Tickets can only be reopened within ${REOPEN_WINDOW_DAYS} days of resolution`,
        );
      }
    }
  } else if (!canOperateTicket(user, ticket)) {
    throw errors.notFound('Ticket');
  }

  const now = nowMarker();
  const timestamps: Prisma.TicketUpdateInput = {};
  if (to === 'RESOLVED') timestamps.resolvedAt = now;
  if (to === 'CLOSED') timestamps.closedAt = now;
  if (to === 'OPEN' && from === 'RESOLVED') {
    timestamps.resolvedAt = null; // reopened — clears resolution marker
    timestamps.closedAt = null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.update({
      where: { id },
      data: { status: to, ...timestamps },
      include: TICKET_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'STATUS_CHANGED',
        entityType: 'TICKET',
        entityId: id,
        metadata: { from, to },
      },
    });
    return t;
  });

  // Notify the counterparty
  const recipientId = user.id === updated.customerId ? updated.assigneeId : updated.customerId;
  if (recipientId) {
    await notifyUser(recipientId, 'STATUS_CHANGED', `Ticket ${updated.ticketNumber} is now ${to}`, id);
  }

  emitDomainEvent('ticket.updated', { ticketId: id });
  return toTicketDto(updated, now);
}

/* ---------- assignment ---------- */

export async function assignTicket(user: AuthUser, id: string, input: AssignTicketInput) {
  const ticket = await findTicketOr404(id);
  if (!canOperateTicket(user, ticket)) throw errors.notFound('Ticket');

  let assignee: User | null = null;
  if (input.assigneeId !== null) {
    assignee = await prisma.user.findFirst({
      where: { id: input.assigneeId, role: { in: ['AGENT', 'ADMIN'] }, accountStatus: 'ACTIVE' },
    });
    if (!assignee) throw errors.badRequest('Assignee must be an active agent or admin');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.update({
      where: { id },
      data: {
        assigneeId: input.assigneeId,
        // assigning an OPEN ticket implicitly starts work
        ...(ticket.status === 'OPEN' && input.assigneeId ? { status: 'IN_PROGRESS' as const } : {}),
      },
      include: TICKET_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ASSIGNED',
        entityType: 'TICKET',
        entityId: id,
        metadata: { from: ticket.assigneeId, to: input.assigneeId },
      },
    });
    return t;
  });

  if (input.assigneeId && input.assigneeId !== user.id) {
    await notifyUser(
      input.assigneeId,
      'TICKET_ASSIGNED',
      `Ticket ${updated.ticketNumber} was assigned to you`,
      id,
    );
  }

  emitDomainEvent('ticket.assigned', { ticketId: id, assigneeId: input.assigneeId });
  return toTicketDto(updated, nowMarker());
}

/* ---------- ticket soft-delete (admin only) ---------- */

export async function deleteTicket(user: AuthUser, id: string) {
  const ticket = await findTicketOr404(id);
  await prisma.$transaction([
    prisma.ticket.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'TICKET_DELETED',
        entityType: 'TICKET',
        entityId: id,
        metadata: { ticketNumber: ticket.ticketNumber },
      },
    }),
  ]);
  return { ok: true };
}

/* ---------- comments ---------- */

export async function listComments(user: AuthUser, ticketId: string) {
  const ticket = await findTicketOr404(ticketId);
  if (!canViewTicket(user, ticket)) throw errors.notFound('Ticket');

  const comments = await prisma.comment.findMany({
    where: {
      ticketId,
      // Customers never see internal notes — filtered at the DB layer.
      ...(user.role === 'CUSTOMER' ? { isInternal: false } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: { author: true, attachments: true },
  });
  return comments.map((c) => toCommentDto(c, user.role));
}

export async function addComment(user: AuthUser, ticketId: string, input: CreateCommentInput) {
  const ticket = await findTicketOr404(ticketId);
  if (!canViewTicket(user, ticket)) throw errors.notFound('Ticket');
  if (ticket.status === 'CLOSED') throw errors.forbiddenTransition('Cannot reply to a closed ticket');

  // Customers cannot create internal notes — force the flag, don't trust input.
  const isInternal = user.role === 'CUSTOMER' ? false : input.isInternal;
  if (input.isInternal && user.role === 'CUSTOMER') {
    throw errors.forbidden('Customers cannot create internal notes');
  }

  const now = nowMarker();
  const sideEffects: Prisma.TicketUpdateInput = {};
  // First public staff reply stamps firstResponseAt (SLA metric).
  if (!isInternal && user.role !== 'CUSTOMER' && !ticket.firstResponseAt) {
    sideEffects.firstResponseAt = now;
  }
  // Customer reply on a waiting ticket flips it back to IN_PROGRESS.
  if (user.role === 'CUSTOMER' && !isInternal && ticket.status === 'WAITING_FOR_CUSTOMER') {
    sideEffects.status = 'IN_PROGRESS';
  }

  const comment = await prisma.$transaction(async (tx) => {
    const c = await tx.comment.create({
      data: { ticketId, authorId: user.id, body: input.body, isInternal },
      include: { author: true, attachments: true },
    });
    const ticketUpdate: Prisma.TicketUpdateInput = { updatedAt: now, ...sideEffects };
    await tx.ticket.update({ where: { id: ticketId }, data: ticketUpdate });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'COMMENT_ADDED',
        entityType: 'TICKET',
        entityId: ticketId,
        metadata: { commentId: c.id, isInternal },
      },
    });
    return c;
  });

  // Notify the counterparty on public replies only
  if (!isInternal) {
    const recipientId = user.id === ticket.customerId ? ticket.assigneeId : ticket.customerId;
    if (recipientId && recipientId !== user.id) {
      await notifyUser(recipientId, 'TICKET_REPLY', `New reply on ${ticket.ticketNumber}`, ticketId);
    }
  }

  emitDomainEvent('comment.created', { ticketId, commentId: comment.id });
  return toCommentDto(comment, user.role);
}

/** Edit: author or admin. Customers can edit only their public comments. */
export async function updateComment(
  user: AuthUser,
  commentId: string,
  input: { body: string },
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { ticket: { select: { customerId: true, assigneeId: true, deletedAt: true, status: true } } },
  });
  if (!comment || comment.ticket.deletedAt) throw errors.notFound('Comment');
  if (!canViewTicket(user, comment.ticket)) throw errors.notFound('Comment');
  if (user.role !== 'ADMIN' && comment.authorId !== user.id) {
    throw errors.forbidden('Only the author can edit a comment');
  }
  if (user.role === 'CUSTOMER' && comment.isInternal) throw errors.notFound('Comment');

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.comment.update({
      where: { id: commentId },
      data: { body: input.body },
      include: { author: true, attachments: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'COMMENT_EDITED',
        entityType: 'COMMENT',
        entityId: commentId,
        metadata: { ticketId: comment.ticketId },
      },
    });
    return c;
  });
  return toCommentDto(updated, user.role);
}

/** Delete: author or admin. Row is removed; audit preserves the fact. */
export async function deleteComment(user: AuthUser, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { ticket: { select: { customerId: true, assigneeId: true, deletedAt: true } } },
  });
  if (!comment || comment.ticket.deletedAt) throw errors.notFound('Comment');
  if (!canViewTicket(user, comment.ticket)) throw errors.notFound('Comment');
  if (user.role !== 'ADMIN' && comment.authorId !== user.id) {
    throw errors.forbidden('Only the author or an admin can delete a comment');
  }
  if (user.role === 'CUSTOMER' && comment.isInternal) throw errors.notFound('Comment');

  await prisma.$transaction([
    prisma.attachment.updateMany({ where: { commentId }, data: { commentId: null } }),
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'COMMENT_DELETED',
        entityType: 'COMMENT',
        entityId: commentId,
        metadata: { ticketId: comment.ticketId, wasInternal: comment.isInternal },
      },
    }),
  ]);
  return { ok: true };
}
