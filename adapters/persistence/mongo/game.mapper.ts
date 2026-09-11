import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { Game, GameStatus } from "@/core/domain/game";
import type { Player, PlayerAvatar } from "@/core/domain/player";
import type { Question, QuestionImage } from "@/core/domain/question";
import type { GameResults } from "@/core/domain/results/results-calculator";
import type { NewGame } from "@/core/application/ports/game-repository";

// US-11 §2.4/§4: único lugar de mapeo doc ⇄ dominio ⇄ DTO REST.
// Paridad exacta con las rutas legacy de `app/api/games/**` (congelada en
// `tests/api/legacy-*`). Sin `mongoose`/`next`: tipos y expresiones puras.

// ---------------------------------------------------------------------------
// Documento Mongo (lean o `toObject()`)
// ---------------------------------------------------------------------------

export interface GameDocQuestion {
  _id?: { toString(): string } | string;
  id?: string;
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
  image?: QuestionImage | null;
}

export interface GameDocPlayer {
  id: string;
  name: string;
  gameId?: string;
  answers?: unknown;
  score?: number;
  joinedAt: Date;
  avatar?: PlayerAvatar | null;
}

export interface GameDoc {
  gameCode: string;
  name: string;
  questions?: GameDocQuestion[];
  createdAt: Date;
  creatorId: string;
  status: GameStatus;
  currentQuestionIndex: number;
  currentQuestionStartTime?: number;
  questionTimeLimit?: number;
  locked?: boolean;
  players?: GameDocPlayer[];
}

// ---------------------------------------------------------------------------
// Documento a persistir
// ---------------------------------------------------------------------------

export interface PersistedPlayer {
  id: string;
  name: string;
  gameId: string;
  answers: Record<string, number>;
  score: number;
  joinedAt: Date;
  avatar: PlayerAvatar | null;
}

export interface GamePersistence {
  name: string;
  gameCode: string;
  questions: Array<{
    text: string;
    options: [string, string, string, string];
    correctAnswer: number;
    image: QuestionImage | null;
  }>;
  createdAt: Date;
  creatorId: string;
  status: GameStatus;
  currentQuestionIndex: number;
  currentQuestionStartTime: number;
  questionTimeLimit: number;
  locked: boolean;
  players: PersistedPlayer[];
}

// ---------------------------------------------------------------------------
// DTOs REST por ruta (shapes exactos de `docs/03-CONTRACTS.md` legacy)
// ---------------------------------------------------------------------------

export interface QuestionDto {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
  image: QuestionImage | null;
}

export interface PlayerDto {
  id: string;
  name: string;
  gameId: string;
  answers: Record<string, number>;
  score: number;
  joinedAt: Date;
  avatar?: PlayerAvatar;
}

export interface GameSummaryDto {
  id: string;
  name: string;
  questions: QuestionDto[];
  creatorId: string;
  status: GameStatus;
  currentQuestionIndex: number;
  createdAt: Date;
}

export interface JoinGameDto extends GameSummaryDto {
  players: PlayerDto[];
}

export interface GameDto extends JoinGameDto {
  currentQuestionStartTime: number;
  questionTimeLimit: number;
  locked: boolean;
}

export type StartGameDto = Omit<GameDto, "locked">;

// ---------------------------------------------------------------------------
// Funciones
// ---------------------------------------------------------------------------

/**
 * Única conversión `answers` Mongo → `Record`.
 * Un `Map` (nativo o `MongooseMap`, que extiende `Map` en Mongoose 8) JAMÁS
 * puede pasarse por spread: daría `{}`; por eso se evalúa `instanceof Map`
 * antes del camino de objeto plano.
 */
export function answersToRecord(answers: unknown): Record<string, number> {
  if (answers instanceof Map) return Object.fromEntries(answers as Map<string, number>);
  if (answers && typeof answers === "object") return { ...(answers as Record<string, number>) };
  return {};
}

export function toDomain(doc: GameDoc): Game {
  return {
    id: doc.gameCode,
    name: doc.name,
    questions: (doc.questions ?? []).map((q) => ({
      id: q._id?.toString() || q.id || "",
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      image: q.image ?? null,
    })),
    createdAt: doc.createdAt,
    creatorId: doc.creatorId,
    status: doc.status,
    currentQuestionIndex: doc.currentQuestionIndex,
    players: (doc.players ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      gameId: doc.gameCode,
      answers: answersToRecord(p.answers),
      score: p.score || 0,
      joinedAt: p.joinedAt,
      avatar: p.avatar ?? undefined,
    })),
    currentQuestionStartTime: doc.currentQuestionStartTime || 0,
    questionTimeLimit: doc.questionTimeLimit || DEFAULT_TIME_LIMIT_MS,
    locked: doc.locked || false,
  };
}

export function toPersistencePlayer(player: Player): PersistedPlayer {
  return {
    id: player.id,
    name: player.name,
    gameId: player.gameId,
    answers: { ...player.answers },
    score: player.score,
    joinedAt: player.joinedAt,
    avatar: player.avatar ?? null,
  };
}

export function toPersistence(game: NewGame): GamePersistence {
  return {
    name: game.name,
    gameCode: game.id,
    // Sin `id`/`_id`: Mongoose genera el `_id` de cada pregunta al insertar.
    questions: game.questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      image: q.image ?? null,
    })),
    createdAt: game.createdAt,
    creatorId: game.creatorId,
    status: game.status,
    currentQuestionIndex: game.currentQuestionIndex,
    currentQuestionStartTime: game.currentQuestionStartTime,
    questionTimeLimit: game.questionTimeLimit,
    locked: game.locked ?? false,
    players: game.players.map(toPersistencePlayer),
  };
}

function toQuestionDto(question: Question): QuestionDto {
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    correctAnswer: question.correctAnswer,
    image: question.image ?? null,
  };
}

/** `avatar` SIEMPRE presente como clave (`undefined` si falta), como el legacy. */
export function toPlayerDto(player: Player): PlayerDto {
  return {
    id: player.id,
    name: player.name,
    gameId: player.gameId,
    answers: { ...player.answers },
    score: player.score,
    joinedAt: player.joinedAt,
    avatar: player.avatar ?? undefined,
  };
}

/** `POST /api/games` (201) y `GET /api/games`: 7 claves. */
export function toGameSummaryDto(game: Game): GameSummaryDto {
  return {
    id: game.id,
    name: game.name,
    questions: game.questions.map(toQuestionDto),
    creatorId: game.creatorId,
    status: game.status,
    currentQuestionIndex: game.currentQuestionIndex,
    createdAt: game.createdAt,
  };
}

/** `POST /api/games/join`: summary + `players` (8 claves). */
export function toJoinGameDto(game: Game): JoinGameDto {
  return {
    ...toGameSummaryDto(game),
    players: game.players.map(toPlayerDto),
  };
}

/** `GET /api/games/[gameId]`: join + ciclo de vida (11 claves). */
export function toGameDto(game: Game): GameDto {
  return {
    ...toJoinGameDto(game),
    currentQuestionStartTime: game.currentQuestionStartTime || 0,
    questionTimeLimit: game.questionTimeLimit || DEFAULT_TIME_LIMIT_MS,
    locked: game.locked || false,
  };
}

/** `POST /api/games/[gameId]/start`: como get, sin `locked` (10 claves). */
export function toStartGameDto(game: Game): StartGameDto {
  return {
    id: game.id,
    name: game.name,
    questions: game.questions.map(toQuestionDto),
    creatorId: game.creatorId,
    status: game.status,
    currentQuestionIndex: game.currentQuestionIndex,
    players: game.players.map(toPlayerDto),
    currentQuestionStartTime: game.currentQuestionStartTime || 0,
    questionTimeLimit: game.questionTimeLimit || DEFAULT_TIME_LIMIT_MS,
    createdAt: game.createdAt,
  };
}

/** `GET /api/games/[gameId]/results`: único cambio de presentación, `Math.round(percentage)`. */
export function toResultsDto(results: GameResults): GameResults {
  return {
    ...results,
    leaderboard: results.leaderboard.map((entry) => ({
      ...entry,
      percentage: Math.round(entry.percentage),
    })),
  };
}
