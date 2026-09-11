import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// US-09: caracterización del contrato HTTP de errores legacy (pre-refactor).
// Congela el shape `{ error: string }` y los status/mensajes exactos que las
// rutas actuales devuelven, para que `error-mapper`/`next-response` de US-09
// los respeten. Ninguna ruta toca Mongo real: `@/models/Game` y
// `@/lib/mongoose` están mockeados.

const {
  jsonMock,
  connectToDBMock,
  findOneMock,
  createMock,
  findMock,
  uuidMock,
  uniqueGameCodeMock,
} = vi.hoisted(() => ({
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
  })),
  connectToDBMock: vi.fn(async () => ({ connection: { readyState: 1 } })),
  findOneMock: vi.fn(),
  createMock: vi.fn(),
  findMock: vi.fn(),
  uuidMock: vi.fn(() => "uuid-test-0001"),
  uniqueGameCodeMock: vi.fn(async () => "123456"),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: jsonMock },
}));

vi.mock("@/lib/mongoose", () => ({
  default: connectToDBMock,
}));

vi.mock("@/models/Game", () => ({
  Game: {
    findOne: findOneMock,
    create: createMock,
    find: findMock,
  },
}));

vi.mock("uuid", () => ({
  v4: uuidMock,
}));

vi.mock("@/lib/gameCode", () => ({
  getUniqueGameCode: uniqueGameCodeMock,
}));

import { POST as createGame, GET as listGames } from "../../app/api/games/route";
import { POST as joinGame } from "../../app/api/games/join/route";
import { GET as getGame } from "../../app/api/games/[gameId]/route";
import { GET as getResults } from "../../app/api/games/[gameId]/results/route";

interface CapturedResponse {
  body: { error?: unknown; [key: string]: unknown };
  status: number;
}

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function brokenJsonRequest(): NextRequest {
  return {
    json: async () => {
      throw new Error("JSON inválido");
    },
  } as unknown as NextRequest;
}

async function capture(responsePromise: Promise<unknown>): Promise<CapturedResponse> {
  return (await responsePromise) as unknown as CapturedResponse;
}

async function expectErrorResponse(
  responsePromise: Promise<unknown>,
  status: number,
  message: string
): Promise<void> {
  const response = await capture(responsePromise);
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ error: message });
  expect(typeof response.body.error).toBe("string");
}

const VALID_QUESTION = {
  text: "¿Cuál es la capital de Francia?",
  options: ["París", "Londres", "Berlín", "Madrid"],
  correctAnswer: 0,
};

const SANITIZED_QUESTION = { ...VALID_QUESTION, image: null };

const GAME_PARAMS = { params: { gameId: "123456" } };

describe("contrato HTTP de errores legacy", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("POST /api/games", () => {
    it("un body que no es JSON responde 400 Invalid JSON body", async () => {
      await expectErrorResponse(
        createGame(brokenJsonRequest()),
        400,
        "Invalid JSON body"
      );
    });

    it("un quiz que no pasa sanitize responde 400 con el mensaje del QuizFileError", async () => {
      // El mensaje es variable: lo produce `sanitizeQuizData` en runtime.
      await expectErrorResponse(
        createGame(fakeRequest({ questions: [] })),
        400,
        "El archivo no contiene preguntas."
      );
    });

    it("un quiz sin name responde 400 Missing required fields", async () => {
      await expectErrorResponse(
        createGame(fakeRequest({ questions: [VALID_QUESTION] })),
        400,
        "Missing required fields"
      );
    });

    it("una creación válida responde 201 con el DTO y usa gameCode + límite por defecto", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const gameDoc = {
        gameCode: "123456",
        name: "Geografía",
        questions: [SANITIZED_QUESTION],
        creatorId: "uuid-test-0001",
        status: "waiting",
        currentQuestionIndex: 0,
        createdAt,
      };
      createMock.mockResolvedValue(gameDoc);

      const response = await capture(
        createGame(fakeRequest({ name: "Geografía", questions: [VALID_QUESTION] }))
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        game: {
          id: "123456",
          name: "Geografía",
          questions: [SANITIZED_QUESTION],
          creatorId: "uuid-test-0001",
          status: "waiting",
          currentQuestionIndex: 0,
          createdAt,
        },
      });
      expect(createMock).toHaveBeenCalledWith({
        name: "Geografía",
        gameCode: "123456",
        questions: [SANITIZED_QUESTION],
        creatorId: "uuid-test-0001",
        questionTimeLimit: 20000,
      });
    });

    it("si la creación falla responde 500 Internal server error", async () => {
      createMock.mockRejectedValue(new Error("fallo de mongo"));

      await expectErrorResponse(
        createGame(fakeRequest({ name: "Geografía", questions: [VALID_QUESTION] })),
        500,
        "Internal server error"
      );
    });
  });

  describe("GET /api/games", () => {
    it("lista los juegos mapeando id = gameCode", async () => {
      const createdAt = new Date("2026-01-02T00:00:00.000Z");
      const gameDoc = {
        gameCode: "654321",
        name: "Historia",
        questions: [SANITIZED_QUESTION],
        creatorId: "creator-1",
        status: "waiting",
        currentQuestionIndex: 0,
        createdAt,
      };
      findMock.mockReturnValue({ sort: vi.fn(async () => [gameDoc]) });

      const response = await capture(listGames());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        games: [
          {
            id: "654321",
            name: "Historia",
            questions: [SANITIZED_QUESTION],
            creatorId: "creator-1",
            status: "waiting",
            currentQuestionIndex: 0,
            createdAt,
          },
        ],
      });
    });

    it("si la consulta falla responde 500 Internal server error", async () => {
      findMock.mockImplementation(() => {
        throw new Error("fallo de mongo");
      });

      await expectErrorResponse(listGames(), 500, "Internal server error");
    });
  });

  describe("POST /api/games/join", () => {
    it("sin gameId ni playerName responde 400 con el mensaje de campos requeridos", async () => {
      await expectErrorResponse(
        joinGame(fakeRequest({})),
        400,
        "Game ID and player name are required"
      );
    });

    it("CARACTERIZACIÓN: un body que no es JSON cae al catch y responde 500 (asimetría con POST /api/games)", async () => {
      // Bug conocido: a diferencia de `/api/games`, esta ruta no captura el
      // fallo de `request.json()` y lo trata como error interno.
      await expectErrorResponse(
        joinGame(brokenJsonRequest()),
        500,
        "Internal server error"
      );
    });

    it("una partida inexistente responde 404 Game not found", async () => {
      findOneMock.mockResolvedValue(null);

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "000000", playerName: "Alice" })),
        404,
        "Game not found"
      );
    });

    it("una partida que no está waiting responde 400 Game is no longer accepting players", async () => {
      findOneMock.mockResolvedValue({ status: "active" });

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" })),
        400,
        "Game is no longer accepting players"
      );
    });

    it("una partida locked responde 403 Game entry is locked", async () => {
      findOneMock.mockResolvedValue({ status: "waiting", locked: true });

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" })),
        403,
        "Game entry is locked"
      );
    });

    it("un nombre ya tomado se detecta sin distinguir mayúsculas y responde 400", async () => {
      findOneMock.mockResolvedValue({
        status: "waiting",
        locked: false,
        players: [{ name: "Alice" }],
      });

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "aLiCe" })),
        400,
        "Player name is already taken in this game"
      );
    });

    it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
      findOneMock.mockRejectedValue(new Error("fallo de mongo"));

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" })),
        500,
        "Internal server error"
      );
    });

    it("un join válido responde 200 y agrega al jugador con avatar por defecto", async () => {
      const game = {
        gameCode: "123456",
        name: "Geografía",
        questions: [SANITIZED_QUESTION],
        creatorId: "creator-1",
        status: "waiting",
        currentQuestionIndex: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        players: [] as Array<Record<string, unknown>>,
        save: vi.fn(async () => game),
      };
      findOneMock.mockResolvedValue(game);

      const response = await capture(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" }))
      );

      expect(response.status).toBe(200);
      expect(response.body.player).toEqual({
        id: "uuid-test-0001",
        name: "Alice",
        gameId: "123456",
        answers: {},
        score: 0,
        joinedAt: expect.any(Date),
        avatar: { seed: "Alice" },
      });
      expect(response.body.game).toMatchObject({
        id: "123456",
        players: [
          {
            id: "uuid-test-0001",
            name: "Alice",
            gameId: "123456",
            answers: {},
            score: 0,
            avatar: { seed: "Alice" },
          },
        ],
      });
      expect(game.save).toHaveBeenCalledTimes(1);
      expect(game.players).toHaveLength(1);
    });
  });

  describe("GET /api/games/[gameId]", () => {
    it("una partida inexistente responde 404 Game not found", async () => {
      findOneMock.mockResolvedValue(null);

      await expectErrorResponse(getGame({} as Request, GAME_PARAMS), 404, "Game not found");
    });

    it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
      findOneMock.mockRejectedValue(new Error("fallo de mongo"));

      await expectErrorResponse(
        getGame({} as Request, GAME_PARAMS),
        500,
        "Internal server error"
      );
    });
  });

  describe("GET /api/games/[gameId]/results", () => {
    it("una partida inexistente responde 404 Game not found or no results available", async () => {
      findOneMock.mockResolvedValue(null);

      await expectErrorResponse(
        getResults({} as Request, GAME_PARAMS),
        404,
        "Game not found or no results available"
      );
    });

    it("una partida que no está finished responde 404 Game not found or no results available", async () => {
      findOneMock.mockResolvedValue({ status: "active" });

      await expectErrorResponse(
        getResults({} as Request, GAME_PARAMS),
        404,
        "Game not found or no results available"
      );
    });

    it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
      findOneMock.mockRejectedValue(new Error("fallo de mongo"));

      await expectErrorResponse(
        getResults({} as Request, GAME_PARAMS),
        500,
        "Internal server error"
      );
    });
  });
});
