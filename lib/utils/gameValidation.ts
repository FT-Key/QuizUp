import type { Game, GameResults } from "@/types";

export function calculateGameResults(game: Game): GameResults {
  const totalPlayers = game.players.length;
  const totalQuestions = game.questions.length;

  const leaderboard = game.players.map((player) => ({
    playerId: player.id,
    name: player.name,
    score: player.score,
    correctAnswers: Object.values(player.answers).filter(
      (a, i) => a === game.questions[i]?.correctAnswer
    ).length,
    totalQuestions,
    percentage: player.score / totalQuestions / 100, // o como quieras calcular
  }));

  return {
    gameId: game.id,
    createdAt: new Date(),
    totalPlayers,
    totalQuestions,
    leaderboard,
    questionResults: [], // si quieres, puedes generar los resultados por pregunta
  };
}

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

export function canStartGame(game: Game): boolean {
  return game.status === "waiting" && game.players.length > 0;
}

export function canFinishGame(game: Game): boolean {
  return game.status === "active";
}

export function getAllPlayersAnsweredCurrentQuestion(game: Game): boolean {
  if (
    game.currentQuestionIndex < 0 ||
    game.currentQuestionIndex >= game.questions.length
  ) {
    return false;
  }
  const currentQ = game.questions[game.currentQuestionIndex];
  return (
    game.players.length > 0 &&
    game.players.every((player) => player.answers?.[currentQ.id] !== undefined)
  );
}

export function getPlayerProgress(game: Game): {
  answered: number;
  total: number;
} {
  if (
    game.currentQuestionIndex < 0 ||
    game.currentQuestionIndex >= game.questions.length
  ) {
    return { answered: 0, total: game.players.length };
  }
  const currentQ = game.questions[game.currentQuestionIndex];
  const answered = game.players.filter(
    (player) => player.answers?.[currentQ.id] !== undefined
  ).length;
  const total = game.players.length;

  return { answered, total };
}

export function formatGameId(gameId: string): string {
  return gameId;
}

export function isValidGameId(gameId: string): boolean {
  return /^\d{6}$/.test(gameId);
}
