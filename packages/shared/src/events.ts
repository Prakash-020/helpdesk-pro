import type { CommentDto, NotificationDto, TicketSummaryDto } from './dto';

/**
 * Socket.IO contract. Names + payload types live here so both sides agree.
 * Payloads are pre-stripped DTOs — internal comments are never emitted
 * to customer-authorized rooms (enforced server-side).
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
  [SOCKET_EVENTS.TicketCreated]: (payload: { ticket: TicketSummaryDto }) => void;
  [SOCKET_EVENTS.TicketUpdated]: (payload: { ticket: TicketSummaryDto }) => void;
  [SOCKET_EVENTS.TicketAssigned]: (payload: {
    ticket: TicketSummaryDto;
    assigneeId: string | null;
  }) => void;
  [SOCKET_EVENTS.CommentCreated]: (payload: { ticketId: string; comment: CommentDto }) => void;
  [SOCKET_EVENTS.NotificationCreated]: (payload: { notification: NotificationDto }) => void;
  [SOCKET_EVENTS.TicketSlaWarning]: (payload: { ticket: TicketSummaryDto }) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.JoinTicket]: (payload: { ticketId: string }) => void;
  [SOCKET_EVENTS.LeaveTicket]: (payload: { ticketId: string }) => void;
}
