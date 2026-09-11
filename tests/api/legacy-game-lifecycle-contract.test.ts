import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// US-11: caracterización del contrato de `POST /api/games/[gameId]/start` y
// `POST /api/games/[gameId]/finish` (pre-refactor). Congela status HTTP,
// mensajes de error, efectos de persistencia y el DTO exacto como referencia
// de paridad para los casos de uso StartGame/FinishGame y
// `GameRepository.setStatusAndIndex` de US-11.
//
// Sin Mongo ni red: se mockean `next/server` (capturando el body ANTES de que
// Next lo serialice), `@/lib/mongoose` y `@/models/Game`, siguiendo el patrón
// de `tests/api/legacy-error-contract.test.ts`. Ambas rutas usan `Date.now()`,
// así que los happy paths usan fake timers deterministas.

const { jsonMock, connectToDBMock, findOneMock } = vi.hoisted(() => ({
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
  })),
  connectToDBMock: vi.fn(async () => ({ connection: { readyState: 1 } })),
  findOneMock: vi.fn(),
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

import { POST as startGame } from "../../app/api/games/[gameId]/start/route";
import { POST as finishGame } from "../../app/api/games/[gameId]/finish/route";

interface CapturedResponse {
  /** Body pre-serialización capturado por el mock de `NextResponse.json`. */
  body: any;
  status: number;
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

/** Doc `waiting` tal como lo entrega `findOne`, con los campos que la ruta escribe. */
interface StartGameDoc {
  gameCode: string;
  name: string;
  questions: Array<ReturnType<typeof mongoQuestion>>;
  creatorId: string;
  status: string;
  currentQuestionIndex: number;
  currentQuestionStartTime?: number;
  questionTimeLimit?: number;
  createdAt: Date;
  players: Array<Record<string, unknown>>;
  save: ReturnType<typeof vi.fn>;
}

describe("POST /api/games/[gameId]/start (caracterización US-11)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it("una partida inexistente responde 404 Game not found", async () => {
    findOneMock.mockResolvedValue(null);

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Game not found" });
  });

  it("una partida que no está waiting responde 400 Game cannot be started", async () => {
    findOneMock.mockResolvedValue({ status: "active", players: [{ id: "p1" }] });

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Game cannot be started" });
  });

  it("sin jugadores responde 400 Cannot start game with no players", async () => {
    findOneMock.mockResolvedValue({ status: "waiting", players: [] });

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Cannot start game with no players" });
  });

  it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
    findOneMock.mockRejectedValue(new Error("fallo de mongo"));

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error" });
  });

  it("inicia la partida: persiste 20000 por defecto, fecha con Date.now() fakeado y devuelve el DTO exacto sin locked", async () => {
    vi.useFakeTimers();
    const fakeNow = new Date("2026-03-01T10:00:00.000Z").getTime();
    vi.setSystemTime(fakeNow);

    const q1 = mongoQuestion("q1", "¿Cuál es la capital de Francia?", 2);
    const gameDoc: StartGameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [q1],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 3, // La ruta lo reescribe a 0.
      createdAt: CREATED_AT,
      // Sin `questionTimeLimit`: debe persistirse DEFAULT_TIME_LIMIT_MS (20000).
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "game-id-viejo",
          answers: { q1: 2 },
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana" },
        },
        // Sin `answers`/`score`/`avatar`: la ruta aplica `{}`, `0` y `undefined`.
        { id: "p2", name: "Beto", gameId: "game-id-viejo", joinedAt: JOINED_AT },
      ],
      save: vi.fn(async () => gameDoc),
    };
    findOneMock.mockResolvedValue(gameDoc);

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(connectToDBMock).toHaveBeenCalledTimes(1);
    expect(findOneMock).toHaveBeenCalledWith({ gameCode: "123456" });

    // Efectos sobre el documento persistido:
    expect(gameDoc.status).toBe("active");
    expect(gameDoc.currentQuestionIndex).toBe(0);
    expect(gameDoc.currentQuestionStartTime).toBe(fakeNow);
    expect(gameDoc.questionTimeLimit).toBe(20000);
    expect(gameDoc.save).toHaveBeenCalledTimes(1);

    expect(response.body).toEqual({
      game: {
        id: "123456",
        name: "Geografía",
        questions: [
          { id: "q1", text: q1.text, options: q1.options, correctAnswer: 2, image: null },
        ],
        creatorId: "creator-1",
        status: "active",
        currentQuestionIndex: 0,
        currentQuestionStartTime: fakeNow,
        questionTimeLimit: 20000,
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
            avatar: { seed: "ana" },
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

    // Claves exactas del DTO de start: incluye startTime/timeLimit, NO `locked`.
    expect(Object.keys(response.body.game).sort()).toEqual([
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
    expect(response.body.game).not.toHaveProperty("locked");
    expect(response.body.game.players[1].avatar).toBeUndefined();
  });

  it("respeta el questionTimeLimit ya definido en el doc (no lo pisa con el default)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T10:00:00.000Z").getTime());

    const gameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      questionTimeLimit: 30000,
      createdAt: CREATED_AT,
      players: [{ id: "p1", name: "Ana", joinedAt: JOINED_AT }],
      save: vi.fn(async () => gameDoc),
    };
    findOneMock.mockResolvedValue(gameDoc);

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(gameDoc.questionTimeLimit).toBe(30000);
    expect(response.body.game.questionTimeLimit).toBe(30000);
  });
});

describe("POST /api/games/[gameId]/finish (caracterización US-11)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("una partida inexistente responde 404 Game not found", async () => {
    findOneMock.mockResolvedValue(null);

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Game not found" });
  });

  it("una partida que no está active responde 400 Game cannot be finished", async () => {
    findOneMock.mockResolvedValue({ status: "waiting", questions: [] });

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Game cannot be finished" });
  });

  it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
    findOneMock.mockRejectedValue(new Error("fallo de mongo"));

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error" });
  });

  it("finaliza la partida: status finished, índice en la última pregunta y body exacto { success: true }", async () => {
    const questions = [
      mongoQuestion("q1", "Pregunta 1", 0),
      mongoQuestion("q2", "Pregunta 2", 1),
      mongoQuestion("q3", "Pregunta 3", 2),
    ];
    const gameDoc = {
      gameCode: "123456",
      status: "active",
      currentQuestionIndex: 0,
      questions,
      save: vi.fn(async () => gameDoc),
    };
    findOneMock.mockResolvedValue(gameDoc);

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(connectToDBMock).toHaveBeenCalledTimes(1);
    expect(findOneMock).toHaveBeenCalledWith({ gameCode: "123456" });

    // Efectos sobre el documento persistido:
    expect(gameDoc.status).toBe("finished");
    expect(gameDoc.currentQuestionIndex).toBe(questions.length - 1);
    expect(gameDoc.currentQuestionIndex).toBe(2);
    expect(gameDoc.save).toHaveBeenCalledTimes(1);

    // Body exacto: una sola clave.
    expect(response.body).toEqual({ success: true });
    expect(Object.keys(response.body)).toEqual(["success"]);
  });

  it("CARACTERIZACIÓN: sin preguntas el índice queda en -1 (questions.length - 1)", async () => {
    const gameDoc = {
      status: "active",
      currentQuestionIndex: 0,
      questions: [],
      save: vi.fn(async () => gameDoc),
    };
    findOneMock.mockResolvedValue(gameDoc);

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(gameDoc.currentQuestionIndex).toBe(-1);
    expect(response.body).toEqual({ success: true });
  });
});
