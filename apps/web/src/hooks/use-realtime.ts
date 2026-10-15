import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS } from '@helpdesk/shared';
import { getSocket, disconnectSocket } from '../lib/socket';
import type { UserDto } from '@helpdesk/shared';

/**
 * Mounts once in AppLayout. Socket events carry ids only — the correct
 * response is TanStack Query invalidation, which refetches authoritatively
 * over REST. App stays fully functional when sockets drop.
 */
export function useRealtime(user: UserDto | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }
    const socket = getSocket();

    const invalidateTickets = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    };

    socket.on(SOCKET_EVENTS.TicketCreated, invalidateTickets);
    socket.on(SOCKET_EVENTS.TicketUpdated, invalidateTickets);
    socket.on(SOCKET_EVENTS.TicketAssigned, invalidateTickets);
    socket.on(SOCKET_EVENTS.TicketSlaWarning, invalidateTickets);
    socket.on(SOCKET_EVENTS.CommentCreated, ({ ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    });
    socket.on(SOCKET_EVENTS.NotificationCreated, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      socket.off(SOCKET_EVENTS.TicketCreated, invalidateTickets);
      socket.off(SOCKET_EVENTS.TicketUpdated, invalidateTickets);
      socket.off(SOCKET_EVENTS.TicketAssigned, invalidateTickets);
      socket.off(SOCKET_EVENTS.TicketSlaWarning, invalidateTickets);
      socket.off(SOCKET_EVENTS.CommentCreated);
      socket.off(SOCKET_EVENTS.NotificationCreated);
    };
  }, [user, queryClient]);
}
