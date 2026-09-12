"use client";

import { useEffect, useRef, useState } from "react";
import { getGameSessionFacade } from "@/infra/client-container";
import type { Emit } from "@/adapters/socket/socket-event-bus";
import type { SocketEvents } from "@/types";

/**
 * Unión discriminada evento↔callback del contrato: cada `event` exige el
 * callback de `SocketEvents[event]` (correlación exacta, sin comodines).
 */
export type SocketEvent = {
  [E in keyof SocketEvents]: { event: E; callback: SocketEvents[E] };
}[keyof SocketEvents];

interface UseSocketOptions {
  gameId: string;
  playerName?: string;
  isAdmin?: boolean;
  events?: SocketEvent[];
}

/**
 * Conexión realtime de la página (jugador/admin) sobre `GameSessionFacade`.
 * Devuelve `{ emit, connected }`; el `socket` crudo ya no se expone (US-13).
 */
export const useSocket = ({
  gameId,
  playerName,
  isAdmin = false,
  events = [],
}: UseSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const facade = getGameSessionFacade();

  // Handlers siempre frescos sin re-suscribir por identidad del array.
  const handlersRef = useRef(events);
  useEffect(() => {
    handlersRef.current = events;
  });
  const eventsKey = events.map((e) => e.event).join("|");

  // Conexión + join (misma semántica que el legacy: re-join en cada `connect`).
  useEffect(() => {
    const offConnect = facade.onConnect(() => {
      setConnected(true);
      facade.join({ gameId, playerName, isAdmin });
    });
    const offDisconnect = facade.onDisconnect(() => setConnected(false));

    if (facade.connected) {
      setConnected(true);
      facade.join({ gameId, playerName, isAdmin });
    }

    return () => {
      offConnect();
      offDisconnect();
    };
    // playerName NO es dependencia: paridad con el efecto legacy [gameId, isAdmin].
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facade, gameId, isAdmin]);

  // Suscripción estable: solo cambia si cambian los NOMBRES de evento (no la identidad del array).
  useEffect(() => {
    const names = Array.from(new Set(eventsKey.split("|").filter(Boolean)));
    const unsubs = names.map((name) =>
      facade.on(name, (...args) => {
        for (const { event, callback } of handlersRef.current) {
          if (event === name) {
            // Unión heterogénea de callbacks: cast de despacho confinado (Δ4);
            // el registro `SocketEvent[]` conserva la correlación evento↔payload.
            (callback as (...args: unknown[]) => void)(...args);
          }
        }
      })
    );

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [facade, eventsKey]);

  const emit: Emit = (event, payload) => facade.emit(event, payload);

  return { emit, connected };
};
