import type { Game, SubmitAnswerData } from "@/types";
import type {
  RealtimeClient,
  Unsubscribe,
} from "@/core/application/ports/realtime-client";
import type { PlayerSession } from "@/core/application/ports/player-session";
import type { RetryPolicy } from "@/core/application/ports/retry-policy";
import type { SocketEventBus } from "./socket-event-bus";

export interface GameSessionFacadeDeps {
  realtime: RealtimeClient;
  bus: SocketEventBus;
  session: PlayerSession;
  retryPolicy: RetryPolicy;
  /** Fallback HTTP (Strategy inyectable); el adapter por defecto usa `fetch` global. */
  fetchGame: (gameId: string) => Promise<Game | null>;
}

export interface JoinOptions {
  gameId: string;
  /** Prop prioritaria; si falta se usa la sesión. */
  playerName?: string;
  isAdmin?: boolean;
}

export interface GameSessionFacade {
  readonly connected: boolean;

  /** Admin ⇒ `join-admin`. Jugador ⇒ lee sesión y emite `join-game`; sin nombre, no emite. */
  join(options: JoinOptions): void;

  submitAnswer(payload: SubmitAnswerData): void;
  requestGameState(gameId: string): void;
  lockGame(gameId: string, locked: boolean): void;
  closeGame(gameId: string): void;
  leaveGame(gameId: string, playerId: string): void;

  /** Puerta genérica (comandos del admin y joins de página) para eventos dinámicos. */
  emit(event: string, payload?: unknown): void;

  /** Observer para listas dinámicas de los hooks. Devuelve la baja. */
  on(event: string, handler: (...args: unknown[]) => void): Unsubscribe;
  onConnect(handler: () => void): Unsubscribe;
  onDisconnect(handler: () => void): Unsubscribe;

  /**
   * Pide `request-game-state` cada `retryPolicy.nextDelayMs(n)` (emite solo si hay
   * conexión, pero avanza el plan igual: paridad legacy) y llama `onExhausted`
   * UNA vez al agotarse. Devuelve la cancelación (limpia el timer pendiente).
   */
  scheduleGameStateRetry(
    gameId: string,
    options: { onExhausted: () => void }
  ): Unsubscribe;

  /** Fallback HTTP exacto del legacy: `GET /api/games/:id`; no-ok/JSON sin game/throw ⇒ null. */
  fetchGameState(gameId: string): Promise<Game | null>;
}

export function createGameSessionFacade(
  deps: GameSessionFacadeDeps
): GameSessionFacade {
  const { realtime, bus, session, retryPolicy, fetchGame } = deps;

  // La puerta genérica acepta nombres dinámicos (hooks/páginas); el bus tipado
  // queda detrás de este cast confinado.
  const emitUntyped = bus.emit as unknown as (
    event: string,
    payload?: unknown
  ) => void;

  return {
    get connected() {
      return realtime.connected;
    },

    join({ gameId, playerName, isAdmin = false }) {
      if (isAdmin) {
        bus.emit("join-admin", gameId);
        return;
      }

      const name = playerName || session.get("playerName");
      if (!name) return;

      bus.emit("join-game", {
        gameId,
        playerId: session.get("playerId"),
        playerName: name,
        avatar: {
          seed: session.get("playerAvatarSeed") || name,
          accessories: session.getAccessories(),
        },
      });
    },

    submitAnswer: (payload) => bus.emit("submit-answer", payload),

    requestGameState: (gameId) => bus.emit("request-game-state", { gameId }),

    lockGame: (gameId, locked) => bus.emit("lock-game", { gameId, locked }),

    closeGame: (gameId) => bus.emit("close-game", { gameId }),

    leaveGame: (gameId, playerId) =>
      bus.emit("leave-game", { gameId, playerId }),

    emit: (event, payload) => {
      emitUntyped(event, payload);
    },

    on: (event, handler) => realtime.on(event, handler),

    onConnect: (handler) => realtime.on("connect", () => handler()),

    onDisconnect: (handler) => realtime.on("disconnect", () => handler()),

    scheduleGameStateRetry(gameId, { onExhausted }) {
      let attempt = 1;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const scheduleNext = (): boolean => {
        const delay = retryPolicy.nextDelayMs(attempt);
        if (delay === null) return false;

        timer = setTimeout(() => {
          timer = null;
          if (cancelled) return;

          if (realtime.connected) {
            bus.emit("request-game-state", { gameId });
          }
          attempt += 1;

          if (!scheduleNext()) onExhausted();
        }, delay);

        return true;
      };

      if (!scheduleNext()) {
        onExhausted();
        return () => undefined;
      }

      return () => {
        cancelled = true;
        if (timer !== null) clearTimeout(timer);
      };
    },

    fetchGameState: (gameId) => fetchGame(gameId),
  };
}

/** Default de producción: `fetch` global, mismo contrato que el fallback legacy. */
export function createHttpGameFetcher(): (
  gameId: string
) => Promise<Game | null> {
  return async (gameId) => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) return null;

      const data = (await res.json()) as { game?: Game };
      return data.game ?? null;
    } catch {
      return null;
    }
  };
}
