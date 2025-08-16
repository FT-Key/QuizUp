// lib/socket.ts
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    // Detecta URL de websocket según entorno (NEXT_PUBLIC_SOCKET_URL)
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

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Socket event types
export interface SocketEvents {
  // Client to server
  "join-game": { gameId: string; playerId: string };
  "submit-answer": { playerId: string; answer: number };
  "start-game": { gameId: string };

  // Server to client
  "player-joined": { player: { id: string; name: string } };
  "game-started": { question: { text: string; options: string[] } };
  "answer-submitted": { playerId: string; playerName: string };
  "game-finished": { results: any };
  error: { message: string };
}
