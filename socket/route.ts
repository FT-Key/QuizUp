// app/api/socket/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Server as ServerIO } from "socket.io";
import { gameStore } from "@/lib/gameStore";
import type { Game, GameResults, GameState, Question } from "@/types";

export const runtime = "nodejs";

// ---- Singleton global de Socket.IO ----
declare global {
  var _io: ServerIO | undefined;
}

// ---- Construye el estado completo del juego ----
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

  return {
    game,
    players: game.players,
    currentQuestion,
    results,
  };
}

// ---- Inicializa Socket.IO (singleton global) ----
function initIO(): ServerIO {
  if (global._io) return global._io;

  const io = new ServerIO({
    path: "/api/socket",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  global._io = io;

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // --- PLAYER JOIN ---
    socket.on("join-game", ({ gameId, playerId }: any) => {
      if (!gameId) return;

      socket.join(gameId);
      const game = gameStore.getGame?.(gameId);
      if (!game) return;

      const player = playerId
        ? game.players.find((p) => p.id === playerId)
        : undefined;

      if (player) {
        io.to(`admin-${gameId}`).emit("player-joined", { player });
      } else {
        io.to(`admin-${gameId}`).emit("game-updated", buildGameState(game));
      }
    });

    // --- ADMIN JOIN ---
    socket.on("join-admin", (gameId: string) => {
      if (!gameId) return;
      socket.join(`admin-${gameId}`);

      const game = gameStore.getGame?.(gameId);
      if (game) {
        io.to(socket.id).emit("game-updated", buildGameState(game));
      }
    });

    // --- START GAME ---
    socket.on("start-game", ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      try {
        gameStore.startGame?.(gameId);
        const game = gameStore.getGame?.(gameId);
        if (!game) return;

        const state = buildGameState(game);
        io.to(gameId).emit("game-started", state);
        io.to(gameId).emit("game-updated", state);
        io.to(`admin-${gameId}`).emit("game-updated", state);
      } catch (e) {
        console.error("start-game error:", e);
      }
    });

    // --- SUBMIT ANSWER ---
    socket.on(
      "submit-answer",
      (payload: {
        gameId: string;
        playerId: string;
        questionId?: string;
        answer?: number;
      }) => {
        const { gameId, playerId } = payload || {};
        if (!gameId || !playerId) return;

        const game = gameStore.getGame?.(gameId);
        if (!game) return;

        const currentQ: Question | undefined = payload?.questionId
          ? game.questions.find((q) => q.id === payload.questionId)
          : game.questions[game.currentQuestionIndex];

        if (!currentQ) return;

        const answer =
          typeof payload.answer === "number" ? payload.answer : undefined;
        if (typeof answer !== "number") return;

        try {
          if ((gameStore as any).submitAnswer.length >= 4) {
            (gameStore as any).submitAnswer(
              gameId,
              playerId,
              currentQ.id,
              answer
            );
          } else {
            (gameStore as any).submitAnswer(playerId, answer);
          }
        } catch (e) {
          console.error("submitAnswer error:", e);
        }

        io.to(gameId).emit("answer-submitted", {
          playerId,
          questionId: currentQ.id,
          answer,
        });

        const updated = gameStore.getGame?.(gameId);
        if (updated) {
          const state = buildGameState(updated);
          io.to(gameId).emit("game-updated", state);
          io.to(`admin-${gameId}`).emit("game-updated", state);
        }
      }
    );

    // --- FINISH GAME ---
    socket.on("finish-game", ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      try {
        gameStore.finishGame?.(gameId);
        const game = gameStore.getGame?.(gameId);
        if (!game) return;

        const results: GameResults | undefined = (gameStore as any)
          .getGameResults
          ? (gameStore as any).getGameResults(gameId)
          : undefined;

        if (results) {
          io.to(gameId).emit("game-finished", { results });
          io.to(`admin-${gameId}`).emit("game-finished", { results });
        }

        const state = buildGameState(game);
        io.to(gameId).emit("game-updated", state);
        io.to(`admin-${gameId}`).emit("game-updated", state);
      } catch (e) {
        console.error("finish-game error:", e);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  console.log("Socket.IO initialized (singleton)");
  return io;
}

// ---- GET / POST para inicializar la conexión desde cliente ----
export async function GET(req: NextRequest) {
  initIO();
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  initIO();
  return NextResponse.json({ ok: true });
}
