import { createBrowserPlayerSession } from "@/adapters/session/local-storage-session";
import { createSocketRealtimeClient } from "@/adapters/socket/socket-client";
import { createSocketEventBus } from "@/adapters/socket/socket-event-bus";
import {
  createGameSessionFacade,
  createHttpGameFetcher,
  type GameSessionFacade,
} from "@/adapters/socket/game-session.facade";
import { createFixedRetryPolicy } from "@/core/application/ports/retry-policy";
import type { PlayerSession } from "@/core/application/ports/player-session";

export interface ClientContainer {
  readonly session: PlayerSession;
  readonly gameSession: GameSessionFacade;
}

/**
 * Composition root del navegador (US-13): sesión, socket, bus y facade.
 * No importa `mongoose` ni el container de servidor (`infra/container.ts`).
 */
export function createClientContainer(
  session: PlayerSession = createBrowserPlayerSession()
): ClientContainer {
  const realtime = createSocketRealtimeClient();
  const bus = createSocketEventBus(realtime);
  const gameSession = createGameSessionFacade({
    realtime,
    bus,
    session,
    // US-13 caracterizado: 5 reintentos cada 3000 ms (vista admin).
    retryPolicy: createFixedRetryPolicy({ maxRetries: 5, delayMs: 3000 }),
    fetchGame: createHttpGameFetcher(),
  });

  return { session, gameSession };
}

let sessionCache: PlayerSession | null = null;
let gameSessionCache: GameSessionFacade | null = null;

/**
 * Sesión memoizada; NO crea el socket (`JoinForm` u otros consumidores de
 * solo sesión no deben llamar a `io()`).
 */
export function getPlayerSession(): PlayerSession {
  sessionCache ??= createBrowserPlayerSession();
  return sessionCache;
}

/** Facade memoizada; crea el socket y comparte la sesión memoizada. */
export function getGameSessionFacade(): GameSessionFacade {
  gameSessionCache ??= createClientContainer(getPlayerSession()).gameSession;
  return gameSessionCache;
}

/** Container memoizado: sesión y facade del navegador. */
export function getClientContainer(): ClientContainer {
  return { session: getPlayerSession(), gameSession: getGameSessionFacade() };
}
