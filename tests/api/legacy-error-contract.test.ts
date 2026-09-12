import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { Game } from "@/core/domain/game";
import type { Player } from "@/core/domain/player";
import {
  createFakeContainer,
  type FakeContainerOptions,
  type FakeContainerResult,
} from "@/tests/fakes/container";

// US-09/US-12: caracterización del contrato HTTP de errores legacy. Congela el
// shape `{ error: string }` y los status/mensajes exactos de cada ruta.
//
// Migración US-12: todas las rutas viven sobre `getContainer()` (seam
// `vi.mock("@/infra/container")` + repo fake en memoria); los fallos 500 se
// provocan espiando el método del repo (`vi.spyOn(fake.games, ...)`).

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

const SANITIZED_QUESTION = {
  ...VALID_QUESTION,
  options: VALID_QUESTION.options as [string, string, string, string],
  image: null,
};

const GAME_PARAMS = { params: { gameId: "123456" } };

/** Partida de dominio para sembrar el repo fake de join. */
function gameFixture(overrides: Partial<Game> = {}): Game {
  return {
    id: "123456",
    name: "Geografía",
    questions: [{ ...SANITIZED_QUESTION, id: "q-1" }],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    creatorId: "creator-1",
    status: "waiting",
    currentQuestionIndex: 0,
    players: [],
    currentQuestionStartTime: 0,
    questionTimeLimit: 20000,
    locked: false,
    ...overrides,
  };
}

function playerFixture(overrides: Partial<Player> = {}): Player {
  return {
    id: "p0",
    name: "Alice",
    gameId: "123456",
    answers: {},
    score: 0,
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("contrato HTTP de errores legacy", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let fake: FakeContainerResult;

  function setupFake(options?: FakeContainerOptions): FakeContainerResult {
    fake = createFakeContainer(options);
    getContainerMock.mockReturnValue(fake.container);
    return fake;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupFake();
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

    it("una creación válida responde 201 con el DTO normalizado (D1) y persiste gameCode + límite por defecto", async () => {
      const response = await capture(
        createGame(fakeRequest({ name: "Geografía", questions: [VALID_QUESTION] }))
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        game: {
          id: "123456",
          name: "Geografía",
          // D1 (US-11): preguntas normalizadas con el id sintético del repo.
          questions: [{ ...SANITIZED_QUESTION, id: "q-1" }],
          creatorId: "id-1",
          status: "waiting",
          currentQuestionIndex: 0,
          createdAt: new Date(0),
        },
      });

      // Seam: lo que el legacy pasaba a `Game.create` ahora se lee del repo fake.
      await expect(fake.games.findById("123456")).resolves.toMatchObject({
        name: "Geografía",
        questions: [
          {
            id: "q-1",
            text: VALID_QUESTION.text,
            options: VALID_QUESTION.options,
            correctAnswer: 0,
            image: null,
          },
        ],
        creatorId: "id-1",
        questionTimeLimit: 20000,
      });
    });

    it("si la creación falla responde 500 Internal server error", async () => {
      vi.spyOn(fake.games, "create").mockRejectedValue(new Error("fallo de mongo"));

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
      setupFake({
        seed: [
          {
            id: "654321",
            name: "Historia",
            questions: [{ ...SANITIZED_QUESTION, id: "q-1" }],
            createdAt,
            creatorId: "creator-1",
            status: "waiting",
            currentQuestionIndex: 0,
            players: [],
            currentQuestionStartTime: 0,
            questionTimeLimit: 20000,
            locked: false,
          },
        ],
      });

      const response = await capture(listGames());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        games: [
          {
            id: "654321",
            name: "Historia",
            questions: [{ ...SANITIZED_QUESTION, id: "q-1" }],
            creatorId: "creator-1",
            status: "waiting",
            currentQuestionIndex: 0,
            createdAt,
          },
        ],
      });
    });

    it("si la consulta falla responde 500 Internal server error", async () => {
      vi.spyOn(fake.games, "listRecent").mockRejectedValue(new Error("fallo de mongo"));

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
      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "000000", playerName: "Alice" })),
        404,
        "Game not found"
      );
    });

    it("una partida que no está waiting responde 400 Game is no longer accepting players", async () => {
      setupFake({ seed: [gameFixture({ status: "active" })] });

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" })),
        400,
        "Game is no longer accepting players"
      );
    });

    it("una partida locked responde 403 Game entry is locked", async () => {
      setupFake({ seed: [gameFixture({ locked: true })] });

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" })),
        403,
        "Game entry is locked"
      );
    });

    it("un nombre ya tomado se detecta sin distinguir mayúsculas y responde 400", async () => {
      setupFake({ seed: [gameFixture({ players: [playerFixture()] })] });

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "aLiCe" })),
        400,
        "Player name is already taken in this game"
      );
    });

    it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
      vi.spyOn(fake.games, "findById").mockRejectedValue(new Error("fallo de mongo"));

      await expectErrorResponse(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" })),
        500,
        "Internal server error"
      );
    });

    it("un join válido responde 200 y agrega al jugador con avatar por defecto", async () => {
      setupFake({ seed: [gameFixture()] });

      const response = await capture(
        joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" }))
      );

      expect(response.status).toBe(200);
      expect(response.body.player).toEqual({
        // D1 (US-11 §2.1): ids sintéticos deterministas del fake (reemplazan uuid).
        id: "id-1",
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
            id: "id-1",
            name: "Alice",
            gameId: "123456",
            answers: {},
            score: 0,
            avatar: { seed: "Alice" },
          },
        ],
      });
      // Efecto persistido: el repo fake tiene al jugador (antes: `game.save`).
      const stored = await fake.games.findById("123456");
      expect(stored?.players).toHaveLength(1);
      expect(stored?.players[0]).toMatchObject({
        id: "id-1",
        name: "Alice",
        gameId: "123456",
        answers: {},
        score: 0,
        avatar: { seed: "Alice" },
      });
    });
  });

  describe("GET /api/games/[gameId]", () => {
    it("una partida inexistente responde 404 Game not found", async () => {
      await expectErrorResponse(getGame({} as Request, GAME_PARAMS), 404, "Game not found");
    });

    it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
      vi.spyOn(fake.games, "findById").mockRejectedValue(new Error("fallo de mongo"));

      await expectErrorResponse(
        getGame({} as Request, GAME_PARAMS),
        500,
        "Internal server error"
      );
    });
  });

  describe("GET /api/games/[gameId]/results", () => {
    it("una partida inexistente responde 404 Game not found or no results available", async () => {
      await expectErrorResponse(
        getResults({} as Request, GAME_PARAMS),
        404,
        "Game not found or no results available"
      );
    });

    it("una partida que no está finished responde 404 Game not found or no results available", async () => {
      setupFake({ seed: [gameFixture({ status: "active" })] });

      await expectErrorResponse(
        getResults({} as Request, GAME_PARAMS),
        404,
        "Game not found or no results available"
      );
    });

    it("un fallo inesperado de la consulta responde 500 Internal server error", async () => {
      vi.spyOn(fake.games, "findById").mockRejectedValue(new Error("fallo de mongo"));

      await expectErrorResponse(
        getResults({} as Request, GAME_PARAMS),
        500,
        "Internal server error"
      );
    });
  });
});
