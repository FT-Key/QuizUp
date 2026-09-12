import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// US-11: caracterización de los DTOs legacy de `GET /api/games/[gameId]` y
// `POST /api/games/join` (pre-refactor). Congela el JSON exacto que hoy
// devuelven las rutas como referencia de paridad para `toGameDto` /
// `GameRepository` de US-11 (AS-17: mapeo documento→DTO duplicado, con shapes
// distintos por ruta).
//
// Sin Mongo ni red: se mockean `next/server` (capturando el body ANTES de que
// Next lo serialice), `@/lib/mongoose`, `@/models/Game` y `uuid`, siguiendo el
// patrón de `tests/api/legacy-error-contract.test.ts`. Los errores (400/403/404/500)
// de ambas rutas ya están congelados allí; acá solo se caracteriza el happy path.

const { jsonMock, connectToDBMock, findOneMock, uuidMock } = vi.hoisted(() => ({
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
  })),
  connectToDBMock: vi.fn(async () => ({ connection: { readyState: 1 } })),
  findOneMock: vi.fn(),
  uuidMock: vi.fn(() => "uuid-test-0001"),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: jsonMock },
}));

vi.mock("@/lib/mongoose", () => ({
  default: connectToDBMock,
}));

vi.mock("@/models/Game", () => ({
  Game: { findOne: findOneMock },
}));

vi.mock("uuid", () => ({
  v4: uuidMock,
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
    options: ["A", "B", "C", "D"],
    correctAnswer,
    image: null,
  };
}

const GAME_PARAMS = { params: { gameId: "123456" } };
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");

describe("GET /api/games/[gameId] — DTO de game (caracterización US-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mapea preguntas y jugadores con los fallbacks exactos del mapper legacy", async () => {
    const q1 = {
      _id: { toString: () => "q1" },
      text: "¿Cuál es la capital de Francia?",
      options: ["París", "Londres", "Berlín", "Madrid"],
      correctAnswer: 2,
      image: { url: "https://img.test/francia.png", thumb: "https://img.test/francia-thumb.png" },
    };
    // Sin `_id` pero con `id`: el mapper de ESTA ruta NO cae a `q.id`
    // (asimetría legacy con /results, que usa `q._id?.toString() || q.id || ""`).
    const q2 = {
      id: "legacy-q2",
      text: "¿Cuánto es 2 + 2?",
      options: ["3", "4", "5", "6"],
      correctAnswer: 1,
      // sin `image`: la ruta aplica `q.image ?? null`.
    };

    const gameDoc = {
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
        // Sin `answers`/`score`/`avatar`: la ruta aplica `{}`, `0` y `undefined`.
        { id: "p2", name: "Beto", gameId: "game-id-viejo", joinedAt: JOINED_AT },
      ],
    };
    findOneMock.mockResolvedValue(gameDoc);

    const response = await capture(getGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(connectToDBMock).toHaveBeenCalledTimes(1);
    expect(findOneMock).toHaveBeenCalledWith({ gameCode: "123456" });
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
            // CARACTERIZACIÓN: sin `_id` el id sale ""; `q.id` se ignora.
            id: "",
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
    findOneMock.mockResolvedValue({
      gameCode: "123456",
      name: "Vacío",
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
    });

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

  it("answers como Map nativo se pasa tal cual y solo se aplana al serializar si es MongooseMap", async () => {
    const answersMap = new Map<string, number>([["q1", 2]]);
    const q1 = mongoQuestion("q1", "¿Cuál es la capital de Francia?", 2);
    findOneMock.mockResolvedValue({
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
    });

    const response = await capture(getGame({} as Request, GAME_PARAMS));

    // La ruta NO normaliza `answers` (a diferencia de /results, que sí hace
    // `p.answers instanceof Map → for..of`): el capturador recibe la MISMA
    // referencia del Map.
    expect(response.body.game.players[0].answers).toBe(answersMap);

    // Decisión de caracterización: se fija además el comportamiento observable
    // con un Map nativo (el fake de este test): JSON.stringify(new Map()) === "{}"
    // porque un Map no tiene `toJSON`. En runtime real Mongoose hidrata `answers`
    // como MongooseMap, que sí define `toJSON()` (mongoose/lib/types/map.js) y lo
    // aplana por defecto a `{ q1: 2 }`: el JSON HTTP real lleva las respuestas.
    // Por eso el mapper de US-11 debe convertir Map→Record explícitamente (como
    // /results) y NUNCA hacer spread de un Map (daría `{}` incluso con MongooseMap).
    expect(JSON.parse(JSON.stringify(response.body)).game.players[0].answers).toEqual({});
    expect(JSON.parse(JSON.stringify(response.body)).game.players[0].score).toBe(500);
  });
});

describe("POST /api/games/join — DTO de éxito (caracterización US-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Doc `waiting` listo para aceptar jugadores; `players` se puede pre-poblar. */
  function joinableGame(players: Array<Record<string, unknown>> = []) {
    const game = {
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
      save: vi.fn(async () => game),
    };
    return game;
  }

  it("un avatar provisto por el cliente se respeta y `questions` se devuelve sin mapear", async () => {
    const game = joinableGame();
    const avatar = { seed: "custom", accessories: ["glasses"] };
    findOneMock.mockResolvedValue(game);

    const response = await capture(
      joinGame(fakeRequest({ gameId: "123456", playerName: "Alice", avatar }))
    );

    expect(response.status).toBe(200);
    // Misma referencia: la ruta no clona el avatar ni aplica el default `{ seed: name }`.
    expect(response.body.player.avatar).toBe(avatar);
    // `questions: game.questions`: el DTO de join NO mapea las preguntas
    // (conserva `_id`), a diferencia de GET /[gameId] y /start.
    expect(response.body.game.questions).toBe(game.questions);
    expect(response.body.game.questions[0]).toHaveProperty("_id");
    expect(response.body.game.questions[0]).not.toHaveProperty("id");
    expect(game.save).toHaveBeenCalledTimes(1);
  });

  it("sin avatar usa el default `{ seed: playerName }` y las claves del DTO son exactas", async () => {
    const game = joinableGame();
    findOneMock.mockResolvedValue(game);

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

  it("un jugador preexistente del doc NO recibe los fallbacks ni el gameId del DTO de GET", async () => {
    const game = joinableGame([
      // Sin answers/score/avatar y con un gameId que no coincide con el gameCode.
      { id: "p0", name: "Zoe", gameId: "codigo-viejo", joinedAt: JOINED_AT },
    ]);
    findOneMock.mockResolvedValue(game);

    const response = await capture(
      joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" }))
    );

    expect(response.status).toBe(200);
    expect(response.body.game.players).toHaveLength(2);

    const zoe = response.body.game.players[0];
    // El DTO de join pasa los campos tal cual (sin `|| {}` / `|| 0` / `|| undefined`):
    // las claves existen con valor `undefined`.
    expect(Object.keys(zoe).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(zoe.answers).toBeUndefined();
    expect(zoe.score).toBeUndefined();
    expect(zoe.avatar).toBeUndefined();
    // Tampoco sobreescribe `gameId` con el gameCode (a diferencia de GET /[gameId]).
    expect(zoe.gameId).toBe("codigo-viejo");

    const alice = response.body.game.players[1];
    expect(alice).toMatchObject({
      id: "uuid-test-0001",
      name: "Alice",
      gameId: "123456",
      answers: {},
      score: 0,
      avatar: { seed: "Alice" },
    });
  });
});
