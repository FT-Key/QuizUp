import type { GamePhase } from "./types";

/** Fases de UI del jugador (BL-12): `showing-scoreboard` solo lo produce el timer. */
export const GAME_PHASE = {
  WAITING: "waiting",
  QUESTION: "question",
  SHOWING_RESULT: "showing-result",
  SHOWING_SCOREBOARD: "showing-scoreboard",
} as const satisfies Record<string, GamePhase>;

/** Transición `showing-result` → `showing-scoreboard` de la UI. */
export const SCOREBOARD_PHASE_DELAY_MS = 4000;
