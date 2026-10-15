import type { NotificationDto } from './dto';

/**
 * Socket.IO contract. Event names + payload types live here so both sides
 * agree. PRIVACY RULE: events carry ids only (except notification, which is
 * scoped to the recipient's own room anyway) — clients refetch the resource
 * over REST, so no ticket content or internal notes can ever leak through
 * a broadcast.
 */
export const SOCKET_EVENTS = {
  /* server → client */
  TicketCreated: 'ticket:created',
  TicketUpdated: 'ticket:updated',
  TicketAssigned: 'ticket:assigned',
  CommentCreated: 'comment:created',
  NotificationCreated: 'notification:created',
  TicketSlaWarning: 'ticket:sla_warning',
  /* client → server */
  JoinTicket: 'ticket:join',
  LeaveTicket: 'ticket:leave',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface ServerToClientEvents {
  [SOCKET_EVENTS.TicketCreated]: (payload: { ticketId: string }) => void;
  [SOCKET_EVENTS.TicketUpdated]: (payload: { ticketId: string }) => void;
  [SOCKET_EVENTS.TicketAssigned]: (payload: { ticketId: string; assigneeId: string | null }) => void;
  /** Emitted to staff rooms always; to ticket/customer rooms only when !isInternal. */
  [SOCKET_EVENTS.CommentCreated]: (payload: { ticketId: string; isInternal: boolean }) => void;
  [SOCKET_EVENTS.NotificationCreated]: (payload: { notification: NotificationDto }) => void;
  [SOCKET_EVENTS.TicketSlaWarning]: (payload: { ticketId: string }) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.JoinTicket]: (payload: { ticketId: string }) => void;
  [SOCKET_EVENTS.LeaveTicket]: (payload: { ticketId: string }) => void;
}
