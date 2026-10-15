import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import cookie from 'cookie';
import {
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@helpdesk/shared';
import { webOrigins } from '../config/env';
import { logger } from '../utils/logger';
import { resolveSession } from '../modules/auth/auth.service';
import { prisma } from '../utils/prisma';
import { bus } from '../events/bus';
import { SESSION_COOKIE, hashSessionToken } from '../utils/session-token';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const room = {
  user: (id: string) => `user:${id}`,
  agents: 'role:agents',
  admins: 'role:admins',
  ticket: (id: string) => `ticket:${id}`,
};

/**
 * Socket.IO gateway. Auth = same session cookie as REST (handshake →
 * resolveSession). Rooms: personal user room, staff role rooms, and
 * per-ticket rooms gated by a fresh authorization check on join.
 */
export function initSockets(server: HttpServer): IoServer {
  const io: IoServer = new Server(server, {
    cors: { origin: webOrigins, credentials: true },
  });

  // Handshake auth — parse the session cookie, resolve like a REST request.
  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && !webOrigins.includes(new URL(origin).origin)) {
        return next(new Error('Origin not allowed'));
      }
      const cookies = cookie.parse(socket.handshake.headers.cookie ?? '');
      const token = cookies[SESSION_COOKIE];
      if (!token) return next(new Error('Unauthenticated'));

      const session = await resolveSession(token);
      if (!session) return next(new Error('Unauthenticated'));

      socket.data.user = session.user;
      socket.data.sessionHash = hashSessionToken(token);
      next();
    } catch {
      next(new Error('Unauthenticated'));
    }
  });

  io.on('connection', (socket: IoSocket) => {
    const user = socket.data.user!;
    socket.join(room.user(user.id));
    if (user.role === 'AGENT' || user.role === 'ADMIN') {
      socket.join(room.agents);
      if (user.role === 'ADMIN') socket.join(room.admins);
    }

    socket.on(SOCKET_EVENTS.JoinTicket, async ({ ticketId }) => {
      // Re-authorize: user must be allowed to view this ticket.
      const ticket = await prisma.ticket.findFirst({
        where: { id: ticketId, deletedAt: null },
        select: { customerId: true, assigneeId: true },
      });
      if (!ticket) return;
      const allowed =
        user.role === 'ADMIN' ||
        ticket.customerId === user.id ||
        (user.role === 'AGENT' && (ticket.assigneeId === null || ticket.assigneeId === user.id));
      if (allowed) socket.join(room.ticket(ticketId));
    });

    socket.on(SOCKET_EVENTS.LeaveTicket, ({ ticketId }) => {
      socket.leave(room.ticket(ticketId));
    });
  });

  /* Domain events → room emissions. Payloads are ids only — clients refetch. */
  bus.on('ticket.created', async ({ ticketId }) => {
    io.to(room.agents).to(room.admins).emit(SOCKET_EVENTS.TicketCreated, { ticketId });
    const t = await ticketParties(ticketId);
    if (t) io.to(room.user(t.customerId)).emit(SOCKET_EVENTS.TicketCreated, { ticketId });
  });

  bus.on('ticket.updated', async ({ ticketId }) => {
    io.to(room.ticket(ticketId)).emit(SOCKET_EVENTS.TicketUpdated, { ticketId });
    io.to(room.agents).to(room.admins).emit(SOCKET_EVENTS.TicketUpdated, { ticketId });
    const t = await ticketParties(ticketId);
    if (t) io.to(room.user(t.customerId)).emit(SOCKET_EVENTS.TicketUpdated, { ticketId });
  });

  bus.on('ticket.assigned', async ({ ticketId, assigneeId }) => {
    io.to(room.ticket(ticketId)).to(room.agents).to(room.admins).emit(SOCKET_EVENTS.TicketAssigned, {
      ticketId,
      assigneeId,
    });
    if (assigneeId) io.to(room.user(assigneeId)).emit(SOCKET_EVENTS.TicketAssigned, { ticketId, assigneeId });
  });

  bus.on('comment.created', async ({ ticketId, commentId }) => {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { isInternal: true, authorId: true },
    });
    if (!comment) return;

    // Internal notes → staff rooms only. Public → ticket room + customer.
    if (comment.isInternal) {
      io.to(room.agents).to(room.admins).emit(SOCKET_EVENTS.CommentCreated, {
        ticketId,
        isInternal: true,
      });
    } else {
      io.to(room.ticket(ticketId)).to(room.agents).to(room.admins).emit(
        SOCKET_EVENTS.CommentCreated,
        { ticketId, isInternal: false },
      );
      const t = await ticketParties(ticketId);
      if (t && comment.authorId !== t.customerId) {
        io.to(room.user(t.customerId)).emit(SOCKET_EVENTS.CommentCreated, {
          ticketId,
          isInternal: false,
        });
      }
    }
  });

  bus.on('notification.created', async ({ notificationId }) => {
    const n = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { ticket: { select: { ticketNumber: true } } },
    });
    if (!n) return;
    io.to(room.user(n.recipientId)).emit(SOCKET_EVENTS.NotificationCreated, {
      notification: {
        id: n.id,
        type: n.type,
        message: n.message,
        ticketId: n.ticketId,
        ticketNumber: n.ticket?.ticketNumber ?? null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      },
    });
  });

  logger.info('Socket.IO gateway initialized');
  return io;
}

async function ticketParties(ticketId: string) {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { customerId: true, assigneeId: true },
  });
}
