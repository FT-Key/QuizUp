import { io, type Socket } from "socket.io-client";
import type {
  RealtimeClient,
  RealtimeHandler,
} from "@/core/application/ports/realtime-client";
import type { SocketEvents } from "@/types";

let socket: Socket<SocketEvents> | null = null;

/**
 * Vista dinámica por `string` del socket tipado: el puerto y los hooks manejan
 * nombres de evento variables, fuera del mapa literal de `SocketEvents`. El
 * cast está confinado aquí; el bus es quien restaura el tipado.
 */
interface DynamicSocket {
  on(event: string, handler: RealtimeHandler): unknown;
  off(event: string, handler: RealtimeHandler): unknown;
  emit(event: string, ...args: unknown[]): unknown;
}

const asDynamicSocket = (target: Socket<SocketEvents>): DynamicSocket =>
  target as unknown as DynamicSocket;

export const initSocket = (): Socket<SocketEvents> => {
  if (!socket) {
    const SOCKET_URL =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  return socket;
};

/** Envuelve el singleton en el puerto `RealtimeClient`. */
export function createSocketRealtimeClient(): RealtimeClient {
  const s = initSocket();
  const dynamic = asDynamicSocket(s);

  return {
    get connected() {
      return s.connected;
    },
    on(event, handler) {
      dynamic.on(event, handler);
      return () => {
        dynamic.off(event, handler);
      };
    },
    off(event, handler) {
      dynamic.off(event, handler);
    },
    emit(event, ...args) {
      dynamic.emit(event, ...args);
    },
  };
}
