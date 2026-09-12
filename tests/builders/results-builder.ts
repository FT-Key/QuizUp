import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { Game, GameStatus } from "@/core/domain/game";
import type { Player, PlayerAvatar } from "@/core/domain/player";
import type { Question } from "@/core/domain/question";

/**
 * Builder de escenarios de resultados (US-10).
 *
 * Construye el `Game` de entrada de `calculateResults` (no el `GameResults` de
 * salida; la salida se asserta literal en los tests). Vive en `tests/` porque
 * es una utilidad de fixtures: `core/application/builders/` se reserva para el
 * `QuizBuilder` de producción (US-14). Lo consumen US-10/11.
 */

export interface ResultsPlayerFixture {
  id: string;
  name: string;
  score?: number; // default 0 (score persistido)
  answers?: Record<string, number>; // default {}
  avatar?: PlayerAvatar;
}

/** Pregunta de fixture con options fijas ["A","B","C","D"]. */
export function questionFixture(
  id: string,
  correctAnswer: number,
  text = `Pregunta ${id}`
): Question {
  return {
    id,
    text,
    options: ["A", "B", "C", "D"],
    correctAnswer,
    image: null,
  };
}

export class ResultsBuilder {
  private game: Game = {
    id: "game-1",
    name: "Partida de prueba",
    questions: [],
    createdAt: new Date(0),
    creatorId: "creator-1",
    status: "finished",
    currentQuestionIndex: 0,
    players: [],
    currentQuestionStartTime: 0,
    questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
  };

  withId(id: string): this {
    this.game.id = id;
    return this;
  }

  withName(name: string): this {
    this.game.name = name;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.game.createdAt = createdAt;
    return this;
  }

  withStatus(status: GameStatus): this {
    this.game.status = status;
    return this;
  }

  withQuestion(question: Question): this {
    this.game.questions.push(question);
    return this;
  }

  withQuestions(...questions: Question[]): this {
    this.game.questions.push(...questions);
    return this;
  }

  withPlayer(fixture: ResultsPlayerFixture): this {
    this.game.players.push({
      id: fixture.id,
      name: fixture.name,
      gameId: this.game.id,
      answers: { ...(fixture.answers ?? {}) },
      score: fixture.score ?? 0,
      joinedAt: new Date(0),
      avatar: fixture.avatar,
    });
    return this;
  }

  withPlayers(...fixtures: ResultsPlayerFixture[]): this {
    for (const fixture of fixtures) this.withPlayer(fixture);
    return this;
  }

  withAnswer(playerId: string, questionId: string, answer: number): this {
    this.findPlayer(playerId).answers[questionId] = answer;
    return this;
  }

  withScore(playerId: string, score: number): this {
    this.findPlayer(playerId).score = score;
    return this;
  }

  withAvatar(playerId: string, avatar: PlayerAvatar): this {
    this.findPlayer(playerId).avatar = avatar;
    return this;
  }

  /** Copia defensiva: clona createdAt, questions (+options/image) y players (+answers/joinedAt/avatar). */
  build(): Game {
    return {
      ...this.game,
      createdAt: new Date(this.game.createdAt.getTime()),
      questions: this.game.questions.map((q) => ({
        ...q,
        options: [...q.options] as [string, string, string, string],
        image: q.image ? { ...q.image } : q.image,
      })),
      players: this.game.players.map((p) => ({
        ...p,
        gameId: this.game.id,
        answers: { ...p.answers },
        joinedAt: new Date(p.joinedAt.getTime()),
        avatar: p.avatar ? { ...p.avatar } : p.avatar,
      })),
    };
  }

  private findPlayer(playerId: string): Player {
    const player = this.game.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(
        `ResultsBuilder: no existe el jugador "${playerId}" en la partida`
      );
    }
    return player;
  }
}
