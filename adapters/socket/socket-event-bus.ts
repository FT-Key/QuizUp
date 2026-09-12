import type { PlayerAvatar, SocketEvents } from "@/types";
import type {
  RealtimeClient,
  RealtimeHandler,
  Unsubscribe,
} from "@/core/application/ports/realtime-client";

export type ClientEventName =
  | "join-game"
  | "join-admin"
  | "start-game"
  | "next-question"
  | "finish-question"
  | "finish-game"
  | "submit-answer"
  | "leave-game"
  | "lock-game"
  | "close-game"
  | "request-dashboard"
  | "request-game-state";

export type ServerEventName = Exclude<keyof SocketEvents, ClientEventName>;

/**
 * Payload REAL que emite hoy `join-game`: `playerId` puede ser `null`.
 * `types/index.ts` declara `playerId?: string` (drift reportado en el design,
 * §10-D3); el bus tipa el comportamiento caracterizado sin tocar el contrato.
 */
export interface JoinGameEmitPayload {
  gameId: string;
  playerId?: string | null;
  playerName?: string;
  avatar?: PlayerAvatar;
}

/**
 * Payload del evento según el mapa del contrato. Los eventos sin payload
 * (p. ej. `request-dashboard`, tupla `[]`) producen `undefined`, de modo que
 * `emit("request-dashboard")` compila sin argumentos.
 */
export type ClientEmitPayload<E extends ClientEventName> =
  E extends "join-game"
    ? JoinGameEmitPayload
    : Parameters<SocketEvents[E]> extends [infer P, ...unknown[]]
      ? P
      : undefined;

export interface SocketEventBus {
  on<E extends ServerEventName>(event: E, handler: SocketEvents[E]): Unsubscribe;
  off<E extends ServerEventName>(event: E, handler: SocketEvents[E]): void;
  emit<E extends ClientEventName>(event: E, payload?: ClientEmitPayload<E>): void;
}

export function createSocketEventBus(realtime: RealtimeClient): SocketEventBus {
  return {
    // Los handlers tipados del contrato no son asignables a `RealtimeHandler`
    // (contravarianza); el cast queda confinado a esta capa tipada.
    on: (event, handler) => {
      const listener = handler as unknown as RealtimeHandler;
      return realtime.on(event, listener);
    },

    off: (event, handler) => {
      realtime.off(event, handler as unknown as RealtimeHandler);
    },

    emit: (event, payload) => {
      // Los eventos sin payload del contrato se emiten sin argumentos.
      if (payload === undefined) {
        realtime.emit(event);
      } else {
        realtime.emit(event, payload);
      }
    },
  };
}
