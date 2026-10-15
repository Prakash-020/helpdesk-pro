import type { Prisma } from '@prisma/client';
import type {
  AttachmentDto,
  CommentDto,
  Role,
  TicketDto,
  TicketSummaryDto,
} from '@helpdesk/shared';

/** Shared include — one shape for detail + list serialization. */
export const TICKET_INCLUDE = {
  customer: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TicketInclude;

export type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

function isBreached(
  t: { status: string; responseDueAt: Date | null; resolutionDueAt: Date | null; firstResponseAt: Date | null },
  now: Date,
): boolean {
  if (t.status === 'RESOLVED' || t.status === 'CLOSED') return false;
  return (
    (t.responseDueAt !== null && t.firstResponseAt === null && t.responseDueAt < now) ||
    (t.resolutionDueAt !== null && t.resolutionDueAt < now)
  );
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toTicketSummary(t: TicketWithRelations, now: Date): TicketSummaryDto {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    category: t.category ? { id: t.category.id, name: t.category.name } : null,
    customer: { id: t.customer.id, name: t.customer.name },
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
    commentCount: t._count.comments,
    responseDueAt: iso(t.responseDueAt),
    resolutionDueAt: iso(t.resolutionDueAt),
    slaBreached: isBreached(t, now),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function toTicketDto(t: TicketWithRelations, now: Date): TicketDto {
  const summary = toTicketSummary(t, now);
  return {
    ...summary,
    description: t.description,
    customer: { id: t.customer.id, name: t.customer.name, email: t.customer.email },
    firstResponseAt: iso(t.firstResponseAt),
    resolvedAt: iso(t.resolvedAt),
    closedAt: iso(t.closedAt),
  };
}

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: { author: true; attachments: true };
}>;

export function toCommentDto(c: CommentWithAuthor, viewerRole: Role): CommentDto {
  return {
    id: c.id,
    ticketId: c.ticketId,
    // Defense in depth: even if an internal note slips a query filter,
    // the serializer reports it as non-internal AND strips the body.
    isInternal: viewerRole === 'CUSTOMER' ? false : c.isInternal,
    body: viewerRole === 'CUSTOMER' && c.isInternal ? '[internal note]' : c.body,
    author: {
      id: c.author.id,
      name: c.author.name,
      role: c.author.role,
    },
    attachments: c.attachments.map(toAttachmentDto),
    createdAt: c.createdAt.toISOString(),
  };
}

export function toAttachmentDto(a: {
  id: string;
  ticketId: string;
  commentId: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): AttachmentDto {
  return {
    id: a.id,
    ticketId: a.ticketId,
    commentId: a.commentId,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}
