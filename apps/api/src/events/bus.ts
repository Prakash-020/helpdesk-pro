import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger';

/**
 * In-process domain event bus (ADR-004). Services emit facts here; the
 * Socket.IO gateway (Phase 11) subscribes and fans out to authorized rooms.
 * Keeping emit points in services means realtime is purely additive.
 */
export const bus = new EventEmitter();
bus.setMaxListeners(50);

export type DomainEvent =
  | { name: 'ticket.created'; ticketId: string }
  | { name: 'ticket.updated'; ticketId: string }
  | { name: 'ticket.assigned'; ticketId: string; assigneeId: string | null }
  | { name: 'comment.created'; ticketId: string; commentId: string }
  | { name: 'attachment.uploaded'; ticketId: string }
  | { name: 'notification.created'; notificationId: string }
  | { name: 'sessions.revoked'; userId: string; actorId: string | null };

type EventName = DomainEvent['name'];
type Payload<N extends EventName> = Omit<Extract<DomainEvent, { name: N }>, 'name'>;

export function emitDomainEvent<N extends EventName>(name: N, payload: Payload<N>) {
  logger.debug({ event: name, payload }, 'domain event');
  bus.emit(name, payload);
}
