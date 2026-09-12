// constants/game.ts
export const DEFAULT_TIME_LIMIT_MS = 20000;
export const TIME_LIMIT_OPTIONS = [20000, 30000, 40000] as const;
/** Fallback de UI cuando la partida no trae `questionTimeLimit` (schema: 30000). */
export const FALLBACK_QUESTION_TIME_LIMIT_MS = 30000;
