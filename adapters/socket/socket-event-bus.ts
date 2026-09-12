import type { SocketEvents } from "@/types";
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
 * Payload del evento según el mapa del contrato. Los eventos sin payload
 * (p. ej. `request-dashboard`, tupla `[]`) producen `undefined`, de modo que
 * `emit("request-dashboard")` compila sin argumentos.
 */
export type ClientEmitPayload<E extends ClientEventName> =
  Parameters<SocketEvents[E]> extends [infer P, ...unknown[]] ? P : undefined;

/**
 * Firma de emisión tipada por evento: correlaciona el nombre con su payload
 * (`join-game` → `JoinGameData`; los eventos sin payload no llevan argumentos).
 */
export type Emit = <E extends ClientEventName>(
  event: E,
  payload?: ClientEmitPayload<E>
) => void;

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
