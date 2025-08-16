// socket-server.ts
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { gameStore } from "@/lib/gameStore";
import type { Game, GameResults, GameState, Question } from "@/types";

const httpServer = createServer(); // no manejamos rutas http, solo WebSocket
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" },
});

function buildGameState(game: Game): GameState {
  const currentQuestion =
    game.status === "active"
      ? game.questions[game.currentQuestionIndex]
      : undefined;

  let results: GameResults | undefined;
  if (game.status === "finished" && (gameStore as any).getGameResults) {
    try {
      results = (gameStore as any).getGameResults(game.id);
    } catch {}
  }

  return { game, players: game.players, currentQuestion, results };
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-game", ({ gameId, playerId }) => {
    socket.join(gameId);

    const game = gameStore.getGame?.(gameId);
    if (!game) return;

    const player = game.players.find((p) => p.id === playerId);
    if (player) {
      io.to(`admin-${gameId}`).emit("player-joined", { player });
    } else {
      io.to(`admin-${gameId}`).emit("game-updated", buildGameState(game));
    }
  });

  socket.on("join-admin", (gameId) => {
    socket.join(`admin-${gameId}`);
    const game = gameStore.getGame?.(gameId);
    if (game) {
      io.to(socket.id).emit("game-updated", buildGameState(game));
    }
  });

  socket.on("start-game", ({ gameId }) => {
    gameStore.startGame?.(gameId);
    const game = gameStore.getGame?.(gameId);
    if (!game) return;

    const state = buildGameState(game);
    io.to(gameId).emit("game-started", state);
    io.to(gameId).emit("game-updated", state);
    io.to(`admin-${gameId}`).emit("game-updated", state);
  });

  socket.on("submit-answer", ({ gameId, playerId, questionId, answer }) => {
    const game = gameStore.getGame?.(gameId);
    if (!game) return;

    const currentQ: Question | undefined = questionId
      ? game.questions.find((q) => q.id === questionId)
      : game.questions[game.currentQuestionIndex];

    if (!currentQ) return;

    if (typeof answer !== "number") return;

    (gameStore as any).submitAnswer(gameId, playerId, currentQ.id, answer);

    const updated = gameStore.getGame?.(gameId);
    if (updated) {
      const state = buildGameState(updated);
      io.to(gameId).emit("game-updated", state);
      io.to(`admin-${gameId}`).emit("game-updated", state);
    }
  });

  socket.on("finish-game", ({ gameId }) => {
    gameStore.finishGame?.(gameId);
    const game = gameStore.getGame?.(gameId);
    if (!game) return;

    const results = (gameStore as any).getGameResults?.(gameId);
    if (results) {
      io.to(gameId).emit("game-finished", { results });
      io.to(`admin-${gameId}`).emit("game-finished", { results });
    }

    const state = buildGameState(game);
    io.to(gameId).emit("game-updated", state);
    io.to(`admin-${gameId}`).emit("game-updated", state);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

httpServer.listen(4000, () => {
  console.log("Socket.IO server listening on http://localhost:4000");
});
