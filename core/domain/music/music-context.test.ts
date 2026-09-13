/**
 * Tests de `resolveMusicContext` (US-22, AC3).
 *
 * Política pura view-status → contexto musical. Sin DOM ni audio: solo el
 * mapeo de `GameStatus`/unión del jugador a la etiqueta de playlist.
 */
import { describe, expect, it } from "vitest";
import type { GameStatus } from "../game";
import {
  MUSIC_CONTEXT,
  resolveMusicContext,
  type MusicContextInput,
} from "./music-context";

describe("resolveMusicContext — vista → contexto musical", () => {
  it("sin input (undefined) ⇒ queue", () => {
    expect(resolveMusicContext()).toBe(MUSIC_CONTEXT.QUEUE);
  });

  it("input vacío ⇒ queue", () => {
    expect(resolveMusicContext({})).toBe(MUSIC_CONTEXT.QUEUE);
  });

  it("gameStatus null ⇒ queue", () => {
    expect(resolveMusicContext({ gameStatus: null })).toBe(MUSIC_CONTEXT.QUEUE);
  });

  it("waiting (lobby) ⇒ queue", () => {
    expect(resolveMusicContext({ gameStatus: "waiting" })).toBe(MUSIC_CONTEXT.QUEUE);
  });

  it("active ⇒ game", () => {
    expect(resolveMusicContext({ gameStatus: "active" })).toBe(MUSIC_CONTEXT.GAME);
  });

  it("finished (podio) ⇒ game", () => {
    expect(resolveMusicContext({ gameStatus: "finished" })).toBe(MUSIC_CONTEXT.GAME);
  });

  it("cancelled ⇒ queue", () => {
    expect(resolveMusicContext({ gameStatus: "cancelled" })).toBe(MUSIC_CONTEXT.QUEUE);
  });

  it("isPlayerJoined false con active ⇒ queue (jugador aún no unido)", () => {
    expect(
      resolveMusicContext({ gameStatus: "active", isPlayerJoined: false })
    ).toBe(MUSIC_CONTEXT.QUEUE);
  });

  it("isPlayerJoined false con finished ⇒ queue", () => {
    expect(
      resolveMusicContext({ gameStatus: "finished", isPlayerJoined: false })
    ).toBe(MUSIC_CONTEXT.QUEUE);
  });

  it("isPlayerJoined true explícito conserva el mapeo por status", () => {
    expect(
      resolveMusicContext({ gameStatus: "active", isPlayerJoined: true })
    ).toBe(MUSIC_CONTEXT.GAME);
  });

  it("cubre todos los GameStatus: solo active/finished son game", () => {
    const statuses: readonly GameStatus[] = [
      "waiting",
      "active",
      "finished",
      "cancelled",
    ];
    const expected: Record<GameStatus, string> = {
      waiting: MUSIC_CONTEXT.QUEUE,
      active: MUSIC_CONTEXT.GAME,
      finished: MUSIC_CONTEXT.GAME,
      cancelled: MUSIC_CONTEXT.QUEUE,
    };

    for (const gameStatus of statuses) {
      const input: MusicContextInput = { gameStatus };
      expect(resolveMusicContext(input)).toBe(expected[gameStatus]);
    }
  });
});
