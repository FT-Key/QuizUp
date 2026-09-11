import { io, type Socket } from "socket.io-client";
import type { SocketEvents } from "@/types";

let socket: Socket<SocketEvents> | null = null;

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

    socket.on("connect", () => {

    });

    socket.on("disconnect", () => {

    });

    socket.on("connect_error", (error) => {

    });
  }

  return socket;
};

export const getSocket = (): Socket<SocketEvents> | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
