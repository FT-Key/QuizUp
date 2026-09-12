import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  toDomain,
  type GameDoc,
} from "@/adapters/persistence/mongo/game.mapper";
import {
  createFakeContainer,
  type FakeContainerOptions,
  type FakeContainerResult,
} from "@/tests/fakes/container";

// US-11/US-12: caracterización del contrato de `POST /api/games/[gameId]/start`
// y `POST /api/games/[gameId]/finish`. Congela status HTTP, mensajes de error,
// efectos de persistencia y el DTO exacto como referencia de paridad para los
// casos de uso StartGame/FinishGame y `GameRepository.setStatusAndIndex`.
//
// Migración US-12: seam `vi.mock("@/infra/container")` + repo fake en memoria.
// Los efectos que el legacy assertaba sobre `gameDoc.status/index/save` ahora se
// leen del repo (`repo.findById`); el `Date.now()` fakeado se reemplaza por la
// opción `now` del fake container.

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

import { POST as startGame } from "../../app/api/games/[gameId]/start/route";
import { POST as finishGame } from "../../app/api/games/[gameId]/finish/route";

interface CapturedResponse {
  /** Body pre-serialización capturado por el mock de `NextResponse.json`. */
  body: { game?: unknown; error?: unknown; success?: unknown };
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

describe("POST /api/games/[gameId]/start (caracterización US-11)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupFake();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("una partida inexistente responde 404 Game not found", async () => {
    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Game not found" });
  });

  it("una partida que no está waiting responde 400 Game cannot be started", async () => {
    setupFake({
      seed: [
        toDomain({
          gameCode: "123456",
          name: "Geografía",
          creatorId: "creator-1",
          status: "active",
          currentQuestionIndex: 0,
          createdAt: CREATED_AT,
          players: [{ id: "p1", name: "Ana", joinedAt: JOINED_AT }],
        }),
      ],
    });

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Game cannot be started" });
  });

  it("sin jugadores responde 400 Cannot start game with no players", async () => {
    setupFake({
      seed: [
        toDomain({
          gameCode: "123456",
          name: "Geografía",
          creatorId: "creator-1",
          status: "waiting",
          currentQuestionIndex: 0,
          createdAt: CREATED_AT,
          players: [],
        }),
      ],
    });

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Cannot start game with no players" });
  });

  it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
    vi.spyOn(fake.games, "findById").mockRejectedValue(new Error("fallo de mongo"));

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error" });
  });

  it("inicia la partida: persiste 20000 por defecto, fecha con el clock del container y devuelve el DTO exacto sin locked", async () => {
    const fakeNow = new Date("2026-03-01T10:00:00.000Z").getTime();
    const q1 = mongoQuestion("q1", "¿Cuál es la capital de Francia?", 2);
    const gameDoc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [q1],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 3, // La ruta lo reescribe a 0.
      createdAt: CREATED_AT,
      // Sin `questionTimeLimit`: el dominio lo normaliza a DEFAULT (20000).
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
        // Sin `answers`/`score`/`avatar`: el dominio aplica `{}`, `0` y `undefined`.
        { id: "p2", name: "Beto", gameId: "game-id-viejo", joinedAt: JOINED_AT },
      ],
    };
    setupFake({ seed: [toDomain(gameDoc)], now: fakeNow });

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);

    // Efectos persistidos (antes: `gameDoc.status/index/save`).
    await expect(fake.games.findById("123456")).resolves.toMatchObject({
      status: "active",
      currentQuestionIndex: 0,
      currentQuestionStartTime: fakeNow,
      questionTimeLimit: 20000,
    });

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
            // El DTO usa el `gameId` del dominio (== gameCode).
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
    const body = response.body.game as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
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
    expect(body).not.toHaveProperty("locked");
    expect((body.players as Array<Record<string, unknown>>)[1].avatar).toBeUndefined();
  });

  it("respeta el questionTimeLimit ya definido en el doc (no lo pisa con el default)", async () => {
    const fakeNow = new Date("2026-03-01T10:00:00.000Z").getTime();
    setupFake({
      seed: [
        toDomain({
          gameCode: "123456",
          name: "Geografía",
          questions: [],
          creatorId: "creator-1",
          status: "waiting",
          currentQuestionIndex: 0,
          questionTimeLimit: 30000,
          createdAt: CREATED_AT,
          players: [{ id: "p1", name: "Ana", joinedAt: JOINED_AT }],
        }),
      ],
      now: fakeNow,
    });

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    await expect(fake.games.findById("123456")).resolves.toMatchObject({
      questionTimeLimit: 30000,
    });
    expect(
      (response.body.game as Record<string, unknown>).questionTimeLimit
    ).toBe(30000);
  });
});

describe("POST /api/games/[gameId]/finish (caracterización US-11)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupFake();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("una partida inexistente responde 404 Game not found", async () => {
    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Game not found" });
  });

  it("una partida que no está active responde 400 Game cannot be finished", async () => {
    setupFake({
      seed: [
        toDomain({
          gameCode: "123456",
          name: "Geografía",
          questions: [],
          creatorId: "creator-1",
          status: "waiting",
          currentQuestionIndex: 0,
          createdAt: CREATED_AT,
          players: [],
        }),
      ],
    });

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Game cannot be finished" });
  });

  it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
    vi.spyOn(fake.games, "findById").mockRejectedValue(new Error("fallo de mongo"));

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
    setupFake({
      seed: [
        toDomain({
          gameCode: "123456",
          name: "Geografía",
          questions,
          creatorId: "creator-1",
          status: "active",
          currentQuestionIndex: 0,
          createdAt: CREATED_AT,
          players: [],
        }),
      ],
    });

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);

    // Efectos persistidos (antes: `gameDoc.status/index/save`).
    await expect(fake.games.findById("123456")).resolves.toMatchObject({
      status: "finished",
      currentQuestionIndex: 2,
    });

    // Body exacto: una sola clave.
    expect(response.body).toEqual({ success: true });
    expect(Object.keys(response.body)).toEqual(["success"]);
  });

  it("CARACTERIZACIÓN: sin preguntas el índice queda en -1 (questions.length - 1)", async () => {
    setupFake({
      seed: [
        toDomain({
          gameCode: "123456",
          name: "Geografía",
          questions: [],
          creatorId: "creator-1",
          status: "active",
          currentQuestionIndex: 0,
          createdAt: CREATED_AT,
          players: [],
        }),
      ],
    });

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    await expect(fake.games.findById("123456")).resolves.toMatchObject({
      currentQuestionIndex: -1,
    });
    expect(response.body).toEqual({ success: true });
  });
});
