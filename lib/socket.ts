// Socket.io configuration for client-side
import { io, type Socket } from "socket.io-client"

let socket: Socket | null = null

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NODE_ENV === "production" ? "" : "http://localhost:3000", {
      path: "/api/socket",
      transports: ["websocket", "polling"],
    })

    socket.on("connect", () => {
      console.log("Connected to server:", socket?.id)
    })

    socket.on("disconnect", () => {
      console.log("Disconnected from server")
    })

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error)
    })
  }
  return socket
}

export const getSocket = (): Socket | null => {
  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

// Socket event types
export interface SocketEvents {
  // Client to server
  "join-game": { gameId: string; playerId: string }
  "submit-answer": { playerId: string; answer: number }
  "start-game": { gameId: string }

  // Server to client
  "player-joined": { player: { id: string; name: string } }
  "game-started": { question: { text: string; options: string[] } }
  "answer-submitted": { playerId: string; playerName: string }
  "game-finished": { results: any }
  error: { message: string }
}
