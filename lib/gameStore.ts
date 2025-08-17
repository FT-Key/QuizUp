import type { Game, Player, CreateGameData, Question } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";

// In-memory storage
class GameStore {
  private games: Map<string, Game> = new Map();
  private players: Map<string, Player> = new Map();

  createGame(data: CreateGameData, creatorId: string): Game {
    const questions: Question[] = data.questions.map((q) => ({
      id: uuidv4(),
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
    }));

    const game: Game = {
      id: uuidv4(),
      name: data.name,
      questions,
      createdAt: new Date(),
      creatorId,
      status: "waiting",
      currentQuestionIndex: 0,
      players: [],
      currentQuestionStartTime: 0,
      questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    };

    this.games.set(game.id, game);
    return game;
  }

  getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  getCurrentQuestion(gameId: string): Question | undefined {
    const game = this.games.get(gameId);
    if (!game) return undefined;
    return game.questions[game.currentQuestionIndex];
  }

  addPlayer(gameId: string, playerName: string): Player | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const player: Player = {
      id: uuidv4(),
      name: playerName,
      gameId,
      answers: {},
      score: 0,
      joinedAt: new Date(),
    };

    this.players.set(player.id, player);
    game.players.push(player);

    return player;
  }

  submitAnswer(playerId: string, questionId: string, answer: number) {
    const player = this.players.get(playerId);
    if (!player) return false;

    const game = this.games.get(player.gameId);
    if (!game) return false;

    player.answers[questionId] = answer;

    const question = game.questions.find((q) => q.id === questionId);

    // Bonus por tiempo
    const now = Date.now();
    const elapsed = now - game.currentQuestionStartTime;
    const remainingMs = Math.max(game.questionTimeLimit - elapsed, 0);
    const remainingSeconds = Math.floor(remainingMs / 1000);

    if (question && answer === question.correctAnswer) {
      player.score += 1 + remainingSeconds;
    }

    // Si todos respondieron, terminar pregunta
    const allAnswered = game.players.every(
      (p) => p.answers?.[questionId] !== undefined
    );
    if (allAnswered) {
      return this.finishQuestion(game.id);
    }

    return true;
  }

  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    game.status = "active";
    game.currentQuestionIndex = 0;
    game.currentQuestionStartTime = Date.now();
    return true;
  }

  nextQuestion(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    if (game.currentQuestionIndex + 1 < game.questions.length) {
      game.currentQuestionIndex += 1;
      game.currentQuestionStartTime = Date.now();
      return true;
    } else {
      this.finishGame(gameId);
      return false;
    }
  }

  finishQuestion(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return null;

    const now = Date.now();
    const elapsed = now - game.currentQuestionStartTime;
    const question = game.questions[game.currentQuestionIndex];

    const scores: Record<string, number> = {};

    game.players.forEach((p) => {
      const answer = p.answers[question.id];
      let score = 0;
      if (answer === question.correctAnswer) {
        const remainingMs = Math.max(game.questionTimeLimit - elapsed, 0);
        score = 1 + Math.floor(remainingMs / 1000);
      }
      scores[p.id] = score;
      p.score += score;
    });

    return { scores };
  }

  finishGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    game.status = "finished";
    return true;
  }

  getGameResults(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return null;

    const leaderboard = game.players.map((p) => {
      const correctAnswers = Object.keys(p.answers).filter((qId) => {
        const question = game.questions.find((q) => q.id === qId);
        return question && p.answers[qId] === question.correctAnswer;
      }).length;

      return {
        playerId: p.id,
        name: p.name,
        score: p.score,
        correctAnswers,
        percentage:
          game.questions.length > 0
            ? (correctAnswers / game.questions.length) * 100
            : 0,
      };
    });

    return {
      totalPlayers: game.players.length,
      totalQuestions: game.questions.length,
      leaderboard,
    };
  }

  getAllGames(): Game[] {
    return Array.from(this.games.values());
  }
}

export const gameStore = new GameStore();
