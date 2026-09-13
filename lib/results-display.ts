/**
 * Helpers de presentación del desempate por tiempo del leaderboard (US-20, D-H2.4).
 *
 * Puros y sin dependencias de UI para poder probarlos por unidad; `Results.tsx`
 * los consume para decidir si muestra el badge `Faster answers · X.Xs`.
 */

/** Formatea milisegundos como segundos con un decimal: `45200 -> "45.2s"`. */
export function formatDurationSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * `true` solo para la PRIMERA entrada de cada grupo de empate en `score`
 * (el leaderboard está ordenado ⇒ los empates son adyacentes) cuando ganó el
 * desempate y tiene `totalTimeMs` conocido. Para 3+ empatados, el badge va
 * únicamente en quien encabeza el grupo; sin dato de tiempo no se inventa.
 */
export function isFasterAnswersWinner(
  leaderboard: ReadonlyArray<{ score: number; totalTimeMs?: number }>,
  index: number
): boolean {
  const entry = leaderboard[index];
  if (!entry || entry.totalTimeMs === undefined) return false;

  const previous = leaderboard[index - 1];
  const startsScoreGroup = previous === undefined || previous.score !== entry.score;
  const next = leaderboard[index + 1];
  const tiedWithNext = next !== undefined && next.score === entry.score;

  return startsScoreGroup && tiedWithNext;
}
