import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  toDomain,
  type GameDoc,
} from "@/adapters/persistence/mongo/game.mapper";
import {
  createFakeContainer,
  type FakeContainerOptions,
  type FakeContainerResult,
} from "@/tests/fakes/container";

// US-11/US-12: caracterización de los DTOs legacy de `GET /api/games/[gameId]`
// y `POST /api/games/join`. Congela el JSON exacto como referencia de paridad
// para `toGameDto` / `GameRepository`.
//
// Migración US-12: ambas rutas viven sobre `getContainer()` (seam
// `vi.mock("@/infra/container")` + repo fake); los bloques D1/D2/D3 reflejan las
// desviaciones aprobadas de US-11.

const { jsonMock, getContainerMock } = vi.hoisted(() => ({
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
  })),
  getContainerMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: jsonMock },
}));

vi.mock("@/infra/container", () => ({
  getContainer: getContainerMock,
}));

import { GET as getGame } from "../../app/api/games/[gameId]/route";
import { POST as joinGame } from "../../app/api/games/join/route";

interface CapturedResponse {
  /** Body pre-serialización capturado por el mock de `NextResponse.json`. */
  body: any;
  status: number;
}

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

async function capture(responsePromise: Promise<unknown>): Promise<CapturedResponse> {
  return (await responsePromise) as unknown as CapturedResponse;
}

/** Pregunta tal como la entrega Mongoose: `_id` es un ObjectId con `toString()`. */
function mongoQuestion(id: string, text: string, correctAnswer: number) {
  return {
    _id: { toString: () => id },
    text,
    options: ["A", "B", "C", "D"] as [string, string, string, string],
    correctAnswer,
    image: null,
  };
}

const GAME_PARAMS = { params: { gameId: "123456" } };
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");

let fake: FakeContainerResult;

function setupFake(options?: FakeContainerOptions): FakeContainerResult {
  fake = createFakeContainer(options);
  getContainerMock.mockReturnValue(fake.container);
  return fake;
}

describe("GET /api/games/[gameId] — DTO de game (caracterización US-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFake();
  });

  it("mapea preguntas y jugadores con los fallbacks exactos del mapper legacy", async () => {
    const q1 = {
      _id: { toString: () => "q1" },
      text: "¿Cuál es la capital de Francia?",
      options: ["París", "Londres", "Berlín", "Madrid"] as [
        string,
        string,
        string,
        string
      ],
      correctAnswer: 2,
      image: { url: "https://img.test/francia.png", thumb: "https://img.test/francia-thumb.png" },
    };
    // Sin `_id` pero con `id`: D3 (US-11) unifica el fallback `_id → id → ""`
    // (el legacy de esta ruta ignoraba `q.id` y emitía "").
    const q2 = {
      id: "legacy-q2",
      text: "¿Cuánto es 2 + 2?",
      options: ["3", "4", "5", "6"] as [string, string, string, string],
      correctAnswer: 1,
      // sin `image`: el mapper aplica `q.image ?? null`.
    };

    const gameDoc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [q1, q2],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 2,
      currentQuestionStartTime: 1_700_000_000_000,
      questionTimeLimit: 30000,
      locked: true,
      createdAt: CREATED_AT,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "game-id-viejo",
          answers: { q1: 2 },
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana", accessories: ["hat"] },
        },
        // Sin `answers`/`score`/`avatar`: el dominio aplica `{}`, `0` y `undefined`.
        { id: "p2", name: "Beto", gameId: "game-id-viejo", joinedAt: JOINED_AT },
      ],
    };
    setupFake({ seed: [toDomain(gameDoc)] });

    const response = await capture(getGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      game: {
        id: "123456",
        name: "Geografía",
        questions: [
          {
            id: "q1",
            text: q1.text,
            options: q1.options,
            correctAnswer: 2,
            image: q1.image,
          },
          {
            // D3 (US-11 §10): fallback unificado `_id → id → ""`; con `id`
            // presente sale "legacy-q2" (el legacy sintético daba "").
            id: "legacy-q2",
            text: q2.text,
            options: q2.options,
            correctAnswer: 1,
            image: null,
          },
        ],
        creatorId: "creator-1",
        status: "waiting",
        currentQuestionIndex: 2,
        currentQuestionStartTime: 1_700_000_000_000,
        questionTimeLimit: 30000,
        locked: true,
        createdAt: CREATED_AT,
        players: [
          {
            id: "p1",
            name: "Ana",
            // La ruta sobreescribe `gameId` con `gameDoc.gameCode` (ignora el del doc).
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
        ],
      },
    });

    // `toEqual` ignora las propiedades con `undefined`; la presencia de `avatar`
    // (y del resto de las claves) se fija aparte con `Object.keys`.
    expect(Object.keys(response.body.game).sort()).toEqual([
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
    expect(Object.keys(response.body.game.players[1]).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(response.body.game.players[1].avatar).toBeUndefined();
    expect(Object.keys(response.body.game.questions[1]).sort()).toEqual([
      "correctAnswer",
      "id",
      "image",
      "options",
      "text",
    ]);
  });

  it("un doc sin campos opcionales cae a 0 / 20000 / false y los arrays ausentes quedan vacíos", async () => {
    // Doc mínimo: sin currentQuestionStartTime, questionTimeLimit, locked,
    // questions ni players.
    const gameDoc: GameDoc = {
      gameCode: "123456",
      name: "Vacío",
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
    };
    setupFake({ seed: [toDomain(gameDoc)] });

    const response = await capture(getGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      game: {
        id: "123456",
        name: "Vacío",
        questions: [],
        creatorId: "creator-1",
        status: "waiting",
        currentQuestionIndex: 0,
        // Fallbacks del mapper legacy: `|| 0` y `|| false`.
        currentQuestionStartTime: 0,
        // 20000 es el valor actual de DEFAULT_TIME_LIMIT_MS (constants/game.ts),
        // distinto del default 30000 del schema Mongoose (models/Game.ts).
        questionTimeLimit: 20000,
        locked: false,
        createdAt: CREATED_AT,
        players: [],
      },
    });
  });

  it("answers como Map de Mongoose se normaliza a Record en el DTO (mapper único)", async () => {
    const answersMap = new Map<string, number>([["q1", 2]]);
    const q1 = mongoQuestion("q1", "¿Cuál es la capital de Francia?", 2);
    const gameDoc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [q1],
      creatorId: "creator-1",
      status: "active",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "gameId-viejo",
          answers: answersMap,
          score: 500,
          joinedAt: JOINED_AT,
        },
      ],
    };
    setupFake({ seed: [toDomain(gameDoc)] });

    const response = await capture(getGame({} as Request, GAME_PARAMS));

    // El mapper de US-11 convierte Map→Record explícitamente (como /results):
    // el DTO emite un objeto plano con las respuestas, nunca la referencia del
    // Map (la conversión Map→Record tiene su test en `game.mapper.test.ts`).
    expect(response.body.game.players[0].answers).toEqual({ q1: 2 });
    expect(response.body.game.players[0].answers).not.toBe(answersMap);
    expect(response.body.game.players[0].score).toBe(500);
  });
});

describe("POST /api/games/join — DTO de éxito (caracterización US-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Doc Mongo `waiting`; el seed pasa por `toDomain` (D2/D3 del mapper). */
  function joinableDoc(players: GameDoc["players"] = []): GameDoc {
    return {
      gameCode: "123456",
      name: "Geografía",
      questions: [
        {
          _id: { toString: () => "q1" },
          text: "¿Cuál es la capital de Francia?",
          options: ["París", "Londres", "Berlín", "Madrid"],
          correctAnswer: 0,
          image: null,
        },
      ],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
      players,
    };
  }

  it("un avatar provisto por el cliente se respeta y `questions` se devuelve normalizada (D1)", async () => {
    const avatar = { seed: "custom", accessories: ["glasses"] };
    setupFake({ seed: [toDomain(joinableDoc())] });

    const response = await capture(
      joinGame(fakeRequest({ gameId: "123456", playerName: "Alice", avatar }))
    );

    expect(response.status).toBe(200);
    // Mismo contenido: la ruta no aplica el default `{ seed: name }`. A
    // diferencia del legacy, `parseJoinGameBody` (Zod) entrega un clon
    // estructural del avatar; la identidad de referencia no es observable por
    // HTTP y el JSON es idéntico.
    expect(response.body.player.avatar).toEqual(avatar);
    // D1 (US-11): el DTO normaliza las preguntas a `{ id, text, options,
    // correctAnswer, image }`, sin `_id` (el legacy hacía pass-through).
    expect(response.body.game.questions).toEqual([
      {
        id: "q1",
        text: "¿Cuál es la capital de Francia?",
        options: ["París", "Londres", "Berlín", "Madrid"],
        correctAnswer: 0,
        image: null,
      },
    ]);
    expect(response.body.game.questions[0]).not.toHaveProperty("_id");
    // Efecto persistido: el repo fake tiene al jugador (antes: `game.save`).
    const stored = await fake.games.findById("123456");
    expect(stored?.players).toHaveLength(1);
  });

  it("sin avatar usa el default `{ seed: playerName }` y las claves del DTO son exactas", async () => {
    setupFake({ seed: [toDomain(joinableDoc())] });

    const response = await capture(
      joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" }))
    );

    expect(response.status).toBe(200);
    expect(response.body.player.avatar).toEqual({ seed: "Alice" });
    expect(response.body.game.players[0].avatar).toEqual({ seed: "Alice" });
    expect(Object.keys(response.body.player).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    // Claves exactas del DTO de join: AS-17 documenta que NO expone los campos
    // de ciclo de vida que sí incluye GET /[gameId].
    expect(Object.keys(response.body.game).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "id",
      "name",
      "players",
      "questions",
      "status",
    ]);
    expect(response.body.game).not.toHaveProperty("currentQuestionStartTime");
    expect(response.body.game).not.toHaveProperty("questionTimeLimit");
    expect(response.body.game).not.toHaveProperty("locked");
  });

  it("un jugador preexistente incompleto recibe los fallbacks D2 (incluido el gameId del código)", async () => {
    setupFake({
      seed: [
        toDomain(
          joinableDoc([
            // Sin answers/score/avatar y con un gameId que no coincide con el gameCode:
            // `toDomain` normaliza con los fallbacks D2.
            { id: "p0", name: "Zoe", gameId: "codigo-viejo", joinedAt: JOINED_AT },
          ])
        ),
      ],
    });

    const response = await capture(
      joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" }))
    );

    expect(response.status).toBe(200);
    expect(response.body.game.players).toHaveLength(2);

    const zoe = response.body.game.players[0];
    // D2 (US-11 §10): el mapper unificado normaliza al jugador preexistente
    // (`answers {}`, `score 0`, `gameId` = gameCode, `avatar` undefined) en vez
    // del pass-through legacy que emitía claves `undefined` y el gameId viejo.
    expect(Object.keys(zoe).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(zoe.answers).toEqual({});
    expect(zoe.score).toBe(0);
    expect(zoe.avatar).toBeUndefined();
    expect(zoe.gameId).toBe("123456");

    const alice = response.body.game.players[1];
    expect(alice).toMatchObject({
      // D1: id sintético del fake (reemplaza el uuid legacy).
      id: "id-1",
      name: "Alice",
      gameId: "123456",
      answers: {},
      score: 0,
      avatar: { seed: "Alice" },
    });
  });
});
