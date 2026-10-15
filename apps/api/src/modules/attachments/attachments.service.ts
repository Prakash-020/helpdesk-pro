import { createReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import type { Attachment } from '@prisma/client';
import type { AttachmentDto } from '@helpdesk/shared';
import { env } from '../../config/env';
import { prisma } from '../../utils/prisma';
import { errors } from '../../utils/errors';
import { emitDomainEvent } from '../../events/bus';
import { notifyUser } from '../notifications/notifications.service';
import { toAttachmentDto } from '../tickets/serializers';
import { canViewTicket } from '../tickets/tickets.service';

type AuthUser = NonNullable<Request['user']>;

/* ---------- storage ---------- */

const UPLOAD_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/zip', 'application/json',
]);
const MAX_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdir(UPLOAD_DIR, { recursive: true }).then(() => cb(null, UPLOAD_DIR));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^\w.]/g, '');
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(errors.badRequest(`File type ${file.mimetype} is not allowed`));
    }
    cb(null, true);
  },
});

/* ---------- upload ---------- */

export async function uploadAttachment(
  user: AuthUser,
  ticketId: string,
  file: Express.Multer.File | undefined,
  commentId?: string,
): Promise<AttachmentDto> {
  if (!file) throw errors.badRequest('No file uploaded');

  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
  // Authorize BEFORE touching disk metadata in the response path
  if (!ticket || !canViewTicket(user, ticket)) {
    await unlink(path.join(UPLOAD_DIR, file.filename)).catch(() => {});
    throw errors.notFound('Ticket');
  }
  if (ticket.status === 'CLOSED') {
    await unlink(path.join(UPLOAD_DIR, file.filename)).catch(() => {});
    throw errors.forbiddenTransition('Cannot attach files to a closed ticket');
  }

  const attachment = await prisma.$transaction(async (tx) => {
    const a = await tx.attachment.create({
      data: {
        ticketId,
        commentId: commentId ?? null,
        uploaderId: user.id,
        storageKey: file.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ATTACHMENT_UPLOADED',
        entityType: 'TICKET',
        entityId: ticketId,
        metadata: { attachmentId: a.id, filename: a.originalFilename, sizeBytes: a.sizeBytes },
      },
    });
    return a;
  });

  // Notify the counterparty
  const recipientId = user.id === ticket.customerId ? ticket.assigneeId : ticket.customerId;
  if (recipientId && recipientId !== user.id) {
    await notifyUser(
      recipientId,
      'ATTACHMENT_ADDED',
      `Attachment added to ${ticket.ticketNumber}`,
      ticketId,
    );
  }

  emitDomainEvent('attachment.uploaded', { ticketId });
  return toAttachmentDto(attachment);
}

/* ---------- list / download / delete ---------- */

async function findWithTicket(id: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { ticket: { select: { customerId: true, assigneeId: true, deletedAt: true } } },
  });
  if (!attachment || attachment.ticket.deletedAt) throw errors.notFound('Attachment');
  return attachment;
}

export async function listForTicket(user: AuthUser, ticketId: string) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
  if (!ticket || !canViewTicket(user, ticket)) throw errors.notFound('Ticket');
  const rows = await prisma.attachment.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toAttachmentDto);
}

/** Streams the file; caller must have view rights on the parent ticket. */
export async function download(user: AuthUser, id: string, res: Response) {
  const attachment: Attachment & {
    ticket: { customerId: string; assigneeId: string | null; deletedAt: Date | null };
  } = await findWithTicket(id);
  if (!canViewTicket(user, attachment.ticket)) throw errors.notFound('Attachment');

  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${attachment.originalFilename.replace(/"/g, '')}"`,
  );
  createReadStream(path.join(UPLOAD_DIR, attachment.storageKey)).pipe(res);
}

export async function remove(user: AuthUser, id: string) {
  const attachment = await findWithTicket(id);
  if (user.role !== 'ADMIN' && attachment.uploaderId !== user.id) {
    throw errors.forbidden('Only the uploader or an admin can delete an attachment');
  }
  await prisma.attachment.delete({ where: { id } });
  await unlink(path.join(UPLOAD_DIR, attachment.storageKey)).catch(() => {});
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'ATTACHMENT_DELETED',
      entityType: 'TICKET',
      entityId: attachment.ticketId,
      metadata: { attachmentId: id, filename: attachment.originalFilename },
    },
  });
  return { ok: true };
}
