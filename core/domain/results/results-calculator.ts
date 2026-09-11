import type { Game } from "../game";
import type { PlayerAvatar } from "../player";

export interface GameResults {
  gameId: string;
  createdAt: Date;
  totalPlayers: number;
  totalQuestions: number;
  leaderboard: Array<{
    playerId: string;
    name: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    percentage: number; // 0..100 crudo (sin redondear); la presentación redondea en el mapper REST
    avatar?: PlayerAvatar;
  }>;
  questionResults?: Array<{
    questionId: string;
    questionText: string;
    correctAnswer: number;
    playerAnswers: Array<{
      playerId: string;
      name: string;
      answer: number; // -1 si no respondió
      isCorrect: boolean;
    }>;
  }>;
  averageScore?: number;
}

/**
 * Única función de cálculo de resultados del repo (paridad con la ruta
 * `GET /api/games/[gameId]/results` vigente).
 *
 * - Emite SIEMPRE `questionResults` y `averageScore` (la ruta los emite siempre;
 *   Next no tiene el caller legacy que omitía campos en el WS).
 * - `leaderboard` conserva el orden de `game.players` (no se ordena).
 * - `score` es el puntaje persistido (`p.score`), NO el conteo de aciertos.
 * - `percentage` es crudo: 1/3 ⇒ 33.33333333333333. El redondeo de presentación
 *   pertenece al mapper REST (US-11).
 * - No valida `status === "finished"` (lo hace el caso de uso GetResults, US-11).
 * - No muta `game` ni lee el reloj: reutiliza las fechas existentes.
 */
export function calculateResults(game: Game): GameResults {
  const totalQuestions = game.questions.length;

  const leaderboard = game.players.map((p) => {
    const correctAnswers = Object.keys(p.answers).filter((qId) => {
      const question = game.questions.find((q) => q.id === qId);
      return question !== undefined && p.answers[qId] === question.correctAnswer;
    }).length;

    return {
      playerId: p.id,
      name: p.name,
      score: p.score,
      correctAnswers,
      totalQuestions,
      percentage:
        totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
      avatar: p.avatar, // clave SIEMPRE presente (undefined si no hay avatar)
    };
  });

  const totalScore = game.players.reduce((sum, p) => sum + p.score, 0);

  return {
    gameId: game.id,
    createdAt: game.createdAt,
    totalPlayers: game.players.length,
    totalQuestions,
    leaderboard,
    questionResults: game.questions.map((q) => ({
      questionId: q.id,
      questionText: q.text,
      correctAnswer: q.correctAnswer,
      playerAnswers: game.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        answer: p.answers[q.id] ?? -1,
        isCorrect: p.answers[q.id] === q.correctAnswer,
      })),
    })),
    averageScore: totalScore / (game.players.length || 1), // sin redondear; 0 jugadores ⇒ 0
  };
}
