import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { Game } from "@/core/domain/game";
import type { GameResults } from "@/core/domain/results/results-calculator";
import type { NewGame } from "@/core/application/ports/game-repository";
import {
  answersToRecord,
  toDomain,
  toGameDto,
  toGameSummaryDto,
  toJoinGameDto,
  toPersistence,
  toPersistencePlayer,
  toPlayerDto,
  toResultsDto,
  toStartGameDto,
  type GameDoc,
} from "@/adapters/persistence/mongo/game.mapper";

// US-11 §2.4/§4: paridad del mapper con las rutas legacy. Todo determinista,
// sin Mongo ni red. Los shapes esperados espejan `tests/api/legacy-game-dto-contract`,
// `legacy-game-lifecycle-contract` y `legacy-results-contract`.

/** Subclase con el rasgo relevante de `MongooseMap` 8: extiende `Map` y define `toJSON`. */
class FakeMongooseMap extends Map<string, number> {
  toJSON(): Record<string, number> {
    return Object.fromEntries(this);
  }
}

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");

function gameFixture(overrides: Partial<Game> = {}): Game {
  return {
    id: "123456",
    name: "Geografía",
    questions: [
      {
        id: "q1",
        text: "¿Cuál es la capital de Francia?",
        options: ["París", "Londres", "Berlín", "Madrid"],
        correctAnswer: 2,
        image: { url: "https://img.test/francia.png" },
      },
      {
        id: "q2",
        text: "¿Cuánto es 2 + 2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: 1,
        image: null,
      },
    ],
    createdAt: CREATED_AT,
    creatorId: "creator-1",
    status: "waiting",
    currentQuestionIndex: 1,
    players: [
      {
        id: "p1",
        name: "Ana",
        gameId: "123456",
        answers: { q1: 2 },
        score: 1500,
        joinedAt: JOINED_AT,
        avatar: { seed: "ana", accessories: ["hat"] },
      },
      {
        id: "p2",
        name: "Beto",
        gameId: "123456",
        answers: {},
        score: 0,
        joinedAt: JOINED_AT,
      },
    ],
    currentQuestionStartTime: 1_700_000_000_000,
    questionTimeLimit: 30000,
    locked: true,
    ...overrides,
  };
}

describe("answersToRecord", () => {
  it("convierte un Map nativo a Record", () => {
    const record = answersToRecord(new Map<string, number>([["q1", 2], ["q2", 1]]));

    expect(record).toEqual({ q1: 2, q2: 1 });
  });

  it("convierte una subclase estilo MongooseMap (instanceof Map) sin perder respuestas", () => {
    const mongooseLike = new FakeMongooseMap([["q1", 2], ["q2", 1]]);

    expect(answersToRecord(mongooseLike)).toEqual({ q1: 2, q2: 1 });
    // Regresión que motiva el orden de las ramas: el spread directo de un Map da {}.
    expect({ ...mongooseLike }).toEqual({});
  });

  it("copia un objeto plano sin aliasing", () => {
    const source = { q1: 2, q2: 1 };
    const record = answersToRecord(source);

    expect(record).toEqual({ q1: 2, q2: 1 });
    expect(record).not.toBe(source);
  });

  it("devuelve {} para null, undefined, string y number", () => {
    expect(answersToRecord(null)).toEqual({});
    expect(answersToRecord(undefined)).toEqual({});
    expect(answersToRecord("q1")).toEqual({});
    expect(answersToRecord(42)).toEqual({});
  });
});

describe("toDomain", () => {
  it("mapea un doc completo con preguntas, jugadores y ciclo de vida", () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [
        {
          _id: { toString: () => "q1" },
          text: "¿Cuál es la capital de Francia?",
          options: ["París", "Londres", "Berlín", "Madrid"],
          correctAnswer: 2,
          image: { url: "https://img.test/francia.png" },
        },
        {
          _id: { toString: () => "q2" },
          text: "¿Cuánto es 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: 1,
          // sin image: debe quedar null
        },
      ],
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "active",
      currentQuestionIndex: 2,
      currentQuestionStartTime: 1_700_000_000_000,
      questionTimeLimit: 30000,
      locked: true,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "game-id-viejo",
          answers: new Map<string, number>([["q1", 2]]),
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana", accessories: ["hat"] },
        },
        // Sin answers/score/avatar: fallbacks de la caracterización.
        { id: "p2", name: "Beto", gameId: "game-id-viejo", joinedAt: JOINED_AT },
        // avatar null: la clave debe quedar undefined.
        { id: "p3", name: "Ceci", answers: {}, score: 0, joinedAt: JOINED_AT, avatar: null },
      ],
    };

    const game = toDomain(doc);

    expect(game).toEqual({
      id: "123456",
      name: "Geografía",
      questions: [
        {
          id: "q1",
          text: "¿Cuál es la capital de Francia?",
          options: ["París", "Londres", "Berlín", "Madrid"],
          correctAnswer: 2,
          image: { url: "https://img.test/francia.png" },
        },
        {
          id: "q2",
          text: "¿Cuánto es 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: 1,
          image: null,
        },
      ],
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "active",
      currentQuestionIndex: 2,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "123456",
          answers: { q1: 2 },
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana", accessories: ["hat"] },
        },
        {
          id: "p2",
          name: "Beto",
          gameId: "123456",
          answers: {},
          score: 0,
          joinedAt: JOINED_AT,
          avatar: undefined,
        },
        {
          id: "p3",
          name: "Ceci",
          gameId: "123456",
          answers: {},
          score: 0,
          joinedAt: JOINED_AT,
          avatar: undefined,
        },
      ],
      currentQuestionStartTime: 1_700_000_000_000,
      questionTimeLimit: 30000,
      locked: true,
    });

    // La clave avatar existe aunque su valor sea undefined (paridad con GET/start).
    expect(Object.keys(game.players[1])).toContain("avatar");
    expect(game.players[1].avatar).toBeUndefined();
  });

  it("un doc mínimo cae a [] / 0 / 20000 / false", () => {
    const doc: GameDoc = {
      gameCode: "654321",
      name: "Vacío",
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
    };

    expect(toDomain(doc)).toEqual({
      id: "654321",
      name: "Vacío",
      questions: [],
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      players: [],
      currentQuestionStartTime: 0,
      questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
      locked: false,
    });
    expect(DEFAULT_TIME_LIMIT_MS).toBe(20000);
  });

  it("resuelve el id de pregunta como _id || id || ''", () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Fallbacks",
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      questions: [
        // Sin `_id`, con `id`: gana `id` (superconjunto de la variante get/start).
        {
          id: "legacy-q1",
          text: "Pregunta 1",
          options: ["A", "B", "C", "D"],
          correctAnswer: 0,
        },
        // Con `_id` e `id`: gana `_id`.
        {
          _id: { toString: () => "mongo-q2" },
          id: "legacy-ignorado",
          text: "Pregunta 2",
          options: ["A", "B", "C", "D"],
          correctAnswer: 1,
        },
        // Sin `_id` ni `id`: queda "".
        {
          text: "Pregunta 3",
          options: ["A", "B", "C", "D"],
          correctAnswer: 2,
        },
      ],
    };

    expect(toDomain(doc).questions.map((q) => q.id)).toEqual([
      "legacy-q1",
      "mongo-q2",
      "",
    ]);
  });

  it("conserva el status cancelled y los fallbacks con valores falsy", () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Cancelada",
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "cancelled",
      currentQuestionIndex: 0,
      currentQuestionStartTime: 0,
      questionTimeLimit: 0,
      locked: false,
    };

    const game = toDomain(doc);

    expect(game.status).toBe("cancelled");
    expect(game.currentQuestionStartTime).toBe(0);
    expect(game.questionTimeLimit).toBe(DEFAULT_TIME_LIMIT_MS);
    expect(game.locked).toBe(false);
  });

  it("normaliza answers de MongooseMap (subclase de Map) a Record", () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Map",
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      players: [
        {
          id: "p1",
          name: "Ana",
          joinedAt: JOINED_AT,
          answers: new FakeMongooseMap([["q1", 2]]),
        },
      ],
    };

    expect(toDomain(doc).players[0].answers).toEqual({ q1: 2 });
  });
});

describe("toPersistence", () => {
  it("emite gameCode desde id y preguntas sin id/_id, con Mongo generando los _id", () => {
    const newGame: NewGame = {
      id: "123456",
      name: "Geografía",
      questions: [
        {
          text: "¿Cuál es la capital de Francia?",
          options: ["París", "Londres", "Berlín", "Madrid"],
          correctAnswer: 2,
          image: { url: "https://img.test/francia.png" },
        },
        {
          text: "¿Cuánto es 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: 1,
        },
      ],
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "123456",
          answers: { q1: 2 },
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana" },
        },
        {
          id: "p2",
          name: "Beto",
          gameId: "123456",
          answers: {},
          score: 0,
          joinedAt: JOINED_AT,
        },
      ],
      currentQuestionStartTime: 0,
      questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
      // locked ausente: debe persistirse false.
    };

    const persisted = toPersistence(newGame);

    expect(persisted).toEqual({
      name: "Geografía",
      gameCode: "123456",
      questions: [
        {
          text: "¿Cuál es la capital de Francia?",
          options: ["París", "Londres", "Berlín", "Madrid"],
          correctAnswer: 2,
          image: { url: "https://img.test/francia.png" },
        },
        {
          text: "¿Cuánto es 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: 1,
          image: null,
        },
      ],
      createdAt: CREATED_AT,
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      currentQuestionStartTime: 0,
      questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
      locked: false,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "123456",
          answers: { q1: 2 },
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana" },
        },
        {
          id: "p2",
          name: "Beto",
          gameId: "123456",
          answers: {},
          score: 0,
          joinedAt: JOINED_AT,
          avatar: null,
        },
      ],
    });
    expect(Object.keys(persisted.questions[0]).sort()).toEqual([
      "correctAnswer",
      "image",
      "options",
      "text",
    ]);
    expect(persisted.questions[0]).not.toHaveProperty("_id");
  });

  it("toPersistencePlayer emite avatar null si falta y clona answers", () => {
    const player = gameFixture().players[1];
    const persisted = toPersistencePlayer(player);

    expect(persisted).toEqual({
      id: "p2",
      name: "Beto",
      gameId: "123456",
      answers: {},
      score: 0,
      joinedAt: JOINED_AT,
      avatar: null,
    });
    expect(persisted.answers).not.toBe(player.answers);
  });
});

describe("DTOs REST por ruta", () => {
  it("toGameSummaryDto (create/list) tiene 7 claves y normaliza preguntas", () => {
    const dto = toGameSummaryDto(gameFixture());

    expect(dto).toEqual({
      id: "123456",
      name: "Geografía",
      questions: [
        {
          id: "q1",
          text: "¿Cuál es la capital de Francia?",
          options: ["París", "Londres", "Berlín", "Madrid"],
          correctAnswer: 2,
          image: { url: "https://img.test/francia.png" },
        },
        {
          id: "q2",
          text: "¿Cuánto es 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: 1,
          image: null,
        },
      ],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 1,
      createdAt: CREATED_AT,
    });
    expect(Object.keys(dto).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "id",
      "name",
      "questions",
      "status",
    ]);
    expect(Object.keys(dto.questions[0]).sort()).toEqual([
      "correctAnswer",
      "id",
      "image",
      "options",
      "text",
    ]);
    expect(dto.questions[0]).not.toHaveProperty("_id");
  });

  it("toPlayerDto tiene 7 claves con avatar presente aunque falte", () => {
    const [ana, beto] = gameFixture().players;

    const withAvatar = toPlayerDto(ana);
    expect(Object.keys(withAvatar).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(withAvatar.avatar).toEqual({ seed: "ana", accessories: ["hat"] });

    const withoutAvatar = toPlayerDto(beto);
    expect(Object.keys(withoutAvatar)).toContain("avatar");
    expect(withoutAvatar.avatar).toBeUndefined();
  });

  it("toJoinGameDto (join) tiene 8 claves con players normalizados", () => {
    const dto = toJoinGameDto(gameFixture());

    expect(Object.keys(dto).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "id",
      "name",
      "players",
      "questions",
      "status",
    ]);
    expect(dto.players).toHaveLength(2);
    expect(Object.keys(dto.players[1]).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(dto.players[1].avatar).toBeUndefined();
    expect(dto).not.toHaveProperty("currentQuestionStartTime");
    expect(dto).not.toHaveProperty("questionTimeLimit");
    expect(dto).not.toHaveProperty("locked");
  });

  it("toGameDto (get) tiene 11 claves y aplica fallbacks de ciclo de vida", () => {
    const dto = toGameDto(
      gameFixture({
        currentQuestionStartTime: 0,
        questionTimeLimit: 0,
        locked: undefined,
      })
    );

    expect(Object.keys(dto).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "currentQuestionStartTime",
      "id",
      "locked",
      "name",
      "players",
      "questionTimeLimit",
      "questions",
      "status",
    ]);
    expect(dto.currentQuestionStartTime).toBe(0);
    expect(dto.questionTimeLimit).toBe(DEFAULT_TIME_LIMIT_MS);
    expect(dto.locked).toBe(false);

    const full = toGameDto(gameFixture());
    expect(full.currentQuestionStartTime).toBe(1_700_000_000_000);
    expect(full.questionTimeLimit).toBe(30000);
    expect(full.locked).toBe(true);
  });

  it("toStartGameDto (start) tiene 10 claves y NO incluye locked", () => {
    const dto = toStartGameDto(gameFixture());

    expect(Object.keys(dto).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "currentQuestionStartTime",
      "id",
      "name",
      "players",
      "questionTimeLimit",
      "questions",
      "status",
    ]);
    expect(dto).not.toHaveProperty("locked");
    expect(dto.currentQuestionStartTime).toBe(1_700_000_000_000);
    expect(dto.questionTimeLimit).toBe(30000);
    expect(dto.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("toResultsDto redondea percentage y conserva averageScore y el resto", () => {
    const results: GameResults = {
      gameId: "123456",
      createdAt: CREATED_AT,
      totalPlayers: 2,
      totalQuestions: 3,
      leaderboard: [
        {
          playerId: "p1",
          name: "Ana",
          score: 100,
          correctAnswers: 1,
          totalQuestions: 3,
          percentage: 33.33333333333333,
          avatar: { seed: "ana" },
        },
        {
          playerId: "p2",
          name: "Beto",
          score: 101,
          correctAnswers: 2,
          totalQuestions: 3,
          percentage: 66.66666666666666,
          avatar: undefined,
        },
      ],
      questionResults: [
        {
          questionId: "q1",
          questionText: "Pregunta 1",
          correctAnswer: 0,
          playerAnswers: [
            { playerId: "p1", name: "Ana", answer: 0, isCorrect: true },
          ],
        },
      ],
      averageScore: 100.5,
    };

    const dto = toResultsDto(results);

    expect(dto.leaderboard[0].percentage).toBe(33);
    expect(dto.leaderboard[1].percentage).toBe(67);
    expect(dto.averageScore).toBe(100.5);
    expect(Object.keys(dto.leaderboard[1])).toContain("avatar");
    expect(dto.leaderboard[1].avatar).toBeUndefined();
    expect(dto.questionResults).toEqual(results.questionResults);
    expect(dto).toEqual({
      ...results,
      leaderboard: [
        { ...results.leaderboard[0], percentage: 33 },
        { ...results.leaderboard[1], percentage: 67 },
      ],
    });
    // No muta la entrada del dominio.
    expect(results.leaderboard[0].percentage).toBeCloseTo(33.33333333333333);
  });
});
