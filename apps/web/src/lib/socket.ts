import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@helpdesk/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** Singleton socket — connects lazily once a user is authenticated. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io('/', {
      withCredentials: true, // session cookie rides the handshake
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
