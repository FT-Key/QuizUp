import type { Game, GameResults } from "@/types";

export function calculateGameResults(game: Game): GameResults {
  const totalPlayers = game.players.length;
  const totalQuestions = game.questions.length;

  const leaderboard = game.players.map((player) => {
    const correctAnswers = Object.values(player.answers).filter(
      (answer, index) => answer === game.questions[index]?.correctAnswer
    ).length;

    const score = correctAnswers;
    const percentage =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    return {
      playerId: player.id,
      name: player.name,
      score,
      correctAnswers,
      totalQuestions,
      percentage,
      avatar: player.avatar,
    };
  });

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

export function getAllPlayersAnswered(game: Game): boolean {
  return (
    game.players.length > 0 &&
    game.players.every(
      (player) => Object.keys(player.answers).length === game.questions.length
    )
  );
}

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

export function formatGameId(gameId: string): string {
  return gameId;
}

export function isValidGameId(gameId: string): boolean {
  return /^\d{6}$/.test(gameId);
}

export function calculatePositionChanges(
  currentPlayers: Array<{ playerId: string; score: number }>,
  previousPlayers: Array<{ playerId: string; score: number }>
): Map<string, { previous: number; current: number }> {
  const result = new Map<string, { previous: number; current: number }>();

  const currentSorted = [...currentPlayers].sort((a, b) => b.score - a.score);
  const previousSorted = [...previousPlayers].sort((a, b) => b.score - a.score);

  currentSorted.forEach((current, currentIndex) => {
    const previousIndex = previousSorted.findIndex(
      p => p.playerId === current.playerId
    );
    result.set(current.playerId, {
      previous: previousIndex >= 0 ? previousIndex : currentIndex,
      current: currentIndex,
    });
  });

  return result;
}
