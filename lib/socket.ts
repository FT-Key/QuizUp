import { io, type Socket } from "socket.io-client";
import type { SocketEvents } from "@/types"; // import de tu types/index

let socket: Socket<SocketEvents> | null = null;

/**
 * Inicializa el socket si no está inicializado y lo retorna
 */
export const initSocket = (): Socket<SocketEvents> => {
  if (!socket) {
    const SOCKET_URL =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

    socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Connected to server:", socket?.id);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });
  }

  return socket;
};

/**
 * Retorna el socket si ya fue inicializado
 */
export const getSocket = (): Socket<SocketEvents> | null => socket;

/**
 * Desconecta el socket y limpia la referencia
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
