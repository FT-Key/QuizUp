import type { Game, GameResults } from "@/types";

/**
 * Calcula los resultados de un juego según la nueva interfaz GameResults.
 */
export function calculateGameResults(game: Game): GameResults {
  const totalPlayers = game.players.length;
  const totalQuestions = game.questions.length;

  // Generar leaderboard
  const leaderboard = game.players.map((player) => {
    const correctAnswers = Object.values(player.answers).filter(
      (answer, index) => answer === game.questions[index]?.correctAnswer
    ).length;

    const score = correctAnswers; // Puedes ajustar a otra fórmula si usas puntos distintos
    const percentage =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    return {
      playerId: player.id,
      name: player.name,
      score,
      correctAnswers,
      totalQuestions,
      percentage,
    };
  });

  // Generar resultados por pregunta
  const questionResults = game.questions.map((q) => ({
    questionId: q.id,
    questionText: q.text,
    correctAnswer: q.correctAnswer,
    playerAnswers: game.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      answer: p.answers[q.id] ?? -1,
      isCorrect: (p.answers[q.id] ?? -1) === q.correctAnswer,
    })),
  }));

  return {
    gameId: game.id,
    createdAt: new Date(),
    totalPlayers,
    totalQuestions,
    leaderboard,
    questionResults,
  };
}

/**
 * Devuelve un texto amigable según el estado del juego.
 */
export function getGameStatusDisplay(status: Game["status"]): string {
  switch (status) {
    case "waiting":
      return "Waiting for players";
    case "active":
      return "Game in progress";
    case "finished":
      return "Game completed";
    default:
      return "Unknown status";
  }
}

/**
 * Comprueba si se puede iniciar el juego.
 */
export function canStartGame(game: Game): boolean {
  return game.status === "waiting" && game.players.length > 0;
}

/**
 * Comprueba si se puede finalizar el juego.
 */
export function canFinishGame(game: Game): boolean {
  return game.status === "active";
}

/**
 * Comprueba si todos los jugadores respondieron.
 */
export function getAllPlayersAnswered(game: Game): boolean {
  return (
    game.players.length > 0 &&
    game.players.every(
      (player) => Object.keys(player.answers).length === game.questions.length
    )
  );
}

/**
 * Devuelve progreso de respuestas de los jugadores.
 */
export function getPlayerProgress(game: Game): {
  answered: number;
  total: number;
} {
  const answered = game.players.filter(
    (player) => Object.keys(player.answers).length > 0
  ).length;
  const total = game.players.length;
  return { answered, total };
}

/**
 * Formatea el ID del juego para display.
 */
export function formatGameId(gameId: string): string {
  return gameId.toUpperCase();
}

/**
 * Valida que un gameId sea un UUID válido.
 */
export function isValidGameId(gameId: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(gameId);
}
