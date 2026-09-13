"use client";

/**
 * US-22, D-C.1 — Store cliente del contexto musical (Observer) sin provider.
 *
 * Las vistas publican hechos crudos (`game.status`, si el jugador se unió) vía
 * `useMusicContextPublisher`; el `AudioPlayer` (montado en el layout) consume
 * con `useMusicContext()`. Un store module-level evita envolver el layout con
 * un provider (no cambia el árbol y no rompe los tests de página) y la única
 * derivación vive en `resolveMusicContext` (core puro).
 */
import { useEffect, useSyncExternalStore } from "react";
import type { GameStatus } from "@/core/domain/game";
import {
  MUSIC_CONTEXT,
  resolveMusicContext,
  type MusicContext,
} from "@/core/domain/music/music-context";

let current: MusicContext = MUSIC_CONTEXT.QUEUE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MusicContext {
  return current;
}

function getServerSnapshot(): MusicContext {
  return MUSIC_CONTEXT.QUEUE;
}

/** Publica el contexto derivado (única llamada por vista). */
export function useMusicContextPublisher(
  gameStatus?: GameStatus | null,
  isPlayerJoined = true
): void {
  useEffect(() => {
    const next = resolveMusicContext({ gameStatus, isPlayerJoined });
    if (next === current) return;
    current = next;
    for (const listener of listeners) listener();
  }, [gameStatus, isPlayerJoined]);
}

export function useMusicContext(): MusicContext {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Solo para tests: vuelve al estado inicial y limpia suscriptores. */
export function resetMusicContext(): void {
  current = MUSIC_CONTEXT.QUEUE;
  listeners.clear();
}
