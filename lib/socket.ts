import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Inicializa el socket si no está inicializado y lo retorna
 */
export const initSocket = (): Socket => {
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
export const getSocket = (): Socket | null => socket;

/**
 * Desconecta el socket y limpia la referencia
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Tipado de eventos de Socket.IO
 */
export interface SocketEvents {
  "join-game": { gameId: string; playerId: string };
  "join-admin": { gameId: string };
  "submit-answer": {
    gameId: string;
    playerId: string;
    questionId: string;
    answer: number;
  };
  "start-game": { gameId: string };
  "finish-question": { gameId: string };
  "player-joined": { player: { id: string; name: string } };
  "game-started": { question: { text: string; options: string[] } };
  "answer-submitted": { playerId: string; playerName: string };
  "game-finished": { results: any };
  "game-updated": { game: any };
  error: { message: string };
}
