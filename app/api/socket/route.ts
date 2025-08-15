// app/api/socket/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Server as HttpServer } from "http";
import { Server as ServerIO } from "socket.io";
import { gameStore } from "@/lib/gameStore";
import type { Game, GameResults, GameState, Question } from "@/types";

export const runtime = "nodejs";

// ---- Helpers de tipado para el server subyacente ----
type WithIO = HttpServer & { io?: ServerIO };

// ---- Singleton global para evitar múltiples instancias en dev/HMR ----
declare global {
  // eslint-disable-next-line no-var
  var _io: ServerIO | undefined;
}

function buildGameState(game: Game): GameState {
  const currentQuestion =
    game.status === "active"
      ? game.questions[game.currentQuestionIndex]
      : undefined;

  // Si el juego terminó, pedimos resultados al store (si existen)
  let results: GameResults | undefined;
  if (game.status === "finished" && (gameStore as any).getGameResults) {
    try {
      results = (gameStore as any).getGameResults(game.id);
    } catch {
      // ignoramos si el store aún no tiene resultados
    }
  }

  return {
    game,
    players: game.players,
    currentQuestion,
    results,
  };
}

function initIO(server: WithIO): ServerIO {
  if (global._io) return global._io;

  const io = new ServerIO(server, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
  });
  global._io = io;

  io.on("connection", (socket) => {
    // --- JOIN (jugador o admin) ---
    socket.on("join-game", (payload: any) => {
      const { gameId } = payload || {};
      if (!gameId) return;

      socket.join(gameId);

      const game = gameStore.getGame?.(gameId);
      if (!game) return;

      // Si vino playerId, intentamos notificar a admins con el Player completo
      const player = payload?.playerId
        ? game.players.find((p) => p.id === payload.playerId)
        : undefined;

      if (player) {
        io.to(gameId).emit("player-joined", { player });
      } else {
        // Fallback: emite estado para que admin/otros refresquen
        io.to(gameId).emit("game-updated", buildGameState(game));
      }
    });

    socket.on("join-admin", (gameId: string) => {
      if (!gameId) return;
      socket.join(gameId);

      const game = gameStore.getGame?.(gameId);
      if (game) {
        io.to(socket.id).emit("game-updated", buildGameState(game));
      }
    });

    // --- START GAME (opcional; normalmente lo haces vía API /start) ---
    socket.on("start-game", ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      try {
        gameStore.startGame?.(gameId);
        const game = gameStore.getGame?.(gameId);
        if (!game) return;

        const state = buildGameState(game);
        io.to(gameId).emit("game-started", state);
        io.to(gameId).emit("game-updated", state);
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
        questionId?: string; // nuevo
        answer?: number; // antiguo
        playerName?: string; // legado
      }) => {
        const { gameId, playerId } = payload || {};
        if (!gameId || !playerId) return;

        const game = gameStore.getGame?.(gameId);
        if (!game) return;

        // Soporta payload “viejo”: si no viene questionId, tomamos la actual
        const currentQ: Question | undefined = payload?.questionId
          ? game.questions.find((q) => q.id === payload.questionId)
          : game.questions[game.currentQuestionIndex];

        if (!currentQ) return;

        // answer requerido (para ambos casos)
        const answer =
          typeof (payload as any).answer === "number"
            ? (payload as any).answer
            : undefined;
        if (typeof answer !== "number") return;

        // Llamamos al store con la nueva firma si existe
        try {
          if ((gameStore as any).submitAnswer.length >= 4) {
            // (gameId, playerId, questionId, answer)
            (gameStore as any).submitAnswer(
              gameId,
              playerId,
              currentQ.id,
              answer
            );
          } else {
            // firma antigua: (playerId, answer)
            (gameStore as any).submitAnswer(playerId, answer);
          }
        } catch (e) {
          console.error("submitAnswer error:", e);
        }

        // Notificamos a la sala
        io.to(gameId).emit("answer-submitted", {
          playerId,
          questionId: currentQ.id,
          answer,
        });

        // Emitimos estado actualizado
        const updated = gameStore.getGame?.(gameId);
        if (updated) {
          io.to(gameId).emit("game-updated", buildGameState(updated));
        }
      }
    );

    // --- FINISH GAME (opcional; normalmente vía API /finish) ---
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
        }
        io.to(gameId).emit("game-updated", buildGameState(game));
      } catch (e) {
        console.error("finish-game error:", e);
      }
    });

    socket.on("disconnect", () => {
      // opcional: limpiar algo
    });
  });

  return io;
}

// ⚠️ En App Router no tenemos `res` tipado aquí, pero en runtime Node.js
// Next nos expone `res.socket.server` en la implementación interna.
// Usamos un “shim” devolviendo 200 y asegurando que IO esté inicializado.

function ensureIO(req: NextRequest) {
  const res = (req as any).nextUrl ? (req as any) : null;
  if (!res) return null;

  const server: WithIO | undefined = res?.socket?.server;
  if (!server) return null;

  return initIO(server);
}

export async function GET(req: NextRequest) {
  try {
    // Intenta inicializar IO (idempotente)
    ensureIO(req);
  } catch (e) {
    // En algunos entornos de despliegue, la inicialización real se hace
    // en la primera conexión; no es crítico que falle aquí.
    console.warn("Socket init (GET) warning:", e);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    ensureIO(req);
  } catch (e) {
    console.warn("Socket init (POST) warning:", e);
  }
  return NextResponse.json({ ok: true });
}
