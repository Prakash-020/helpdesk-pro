import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@helpdesk/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** Singleton socket — connects lazily once a user is authenticated. */
export function getSocket(): AppSocket {
  if (!socket) {
    // In dev we connect to the Vite origin (proxy handles /socket.io).
    // In prod point at the API origin directly when they're on different hosts.
    const target =
      import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_URL ?? '/';
    socket = io(target, {
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
