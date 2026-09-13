import { GAME_STATUS } from "../game/constants";
import type { GameStatus } from "../game";

/**
 * Contexto musical de la vista. Es una **política pura** (sin IO): mapea el
 * estado de la partida y si el jugador se unió a la playlist que debe sonar.
 * El audio real vive en `adapters/audio`; aquí no se toca `window`/`Audio`.
 */
export type MusicContext = "queue" | "game";

export const MUSIC_CONTEXT = {
  QUEUE: "queue",
  GAME: "game",
} as const satisfies Record<string, MusicContext>;

export interface MusicContextInput {
  /** status de la partida cuando la vista es /game/*; null/undefined fuera o sin cargar. */
  gameStatus?: GameStatus | null;
  /** false mientras el jugador no se unió; true para admin o fuera de /game/*. */
  isPlayerJoined?: boolean;
}

/**
 * Única derivación status/jugador → contexto (default queue).
 *
 * - Jugador sin unir ⇒ ambiente de lobby (queue), aunque el status sea active.
 * - `active` y `finished` (podio) ⇒ música de partida (game).
 * - `waiting`, `cancelled`, cargando o desconocido ⇒ queue.
 */
export function resolveMusicContext({
  gameStatus,
  isPlayerJoined = true,
}: MusicContextInput = {}): MusicContext {
  if (!isPlayerJoined) return MUSIC_CONTEXT.QUEUE;
  return gameStatus === GAME_STATUS.ACTIVE || gameStatus === GAME_STATUS.FINISHED
    ? MUSIC_CONTEXT.GAME
    : MUSIC_CONTEXT.QUEUE;
}
