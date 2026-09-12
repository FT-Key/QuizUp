import type { GameResults } from "./results-calculator";

/**
 * Accuracy de presentación legacy (paridad exacta con Results.tsx:87-92,134):
 * `toFixed(0)` de `Σ correctAnswers / (totalPlayers * totalQuestions) * 100`;
 * `"0"` cuando `totalPlayers === 0`. Devuelve el string YA formateado.
 */
export function calculateAccuracyFromResults(
  results: Pick<GameResults, "totalPlayers" | "totalQuestions" | "leaderboard">
): string {
  if (results.totalPlayers > 0) {
    const correctAnswers = results.leaderboard.reduce(
      (acc, p) => acc + p.correctAnswers,
      0
    );
    const accuracy =
      (correctAnswers / (results.totalPlayers * results.totalQuestions)) * 100;
    return accuracy.toFixed(0);
  }
  return "0";
}
