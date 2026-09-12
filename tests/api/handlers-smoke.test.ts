import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { Game } from "@/core/domain/game";
import type { Player } from "@/core/domain/player";
import { createFakeContainer } from "@/tests/fakes/container";

// US-12 §6: smoke de un happy path por handler de juego. Verifica status y
// claves top-level del body usando el container fake; los asserts de contrato
// completos viven en los suites `legacy-*` migrados.

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

import { GET as listGames, POST as createGame } from "../../app/api/games/route";
import { POST as joinGame } from "../../app/api/games/join/route";
import { GET as getGame } from "../../app/api/games/[gameId]/route";
import { POST as startGame } from "../../app/api/games/[gameId]/start/route";
import { POST as finishGame } from "../../app/api/games/[gameId]/finish/route";
import { GET as getResults } from "../../app/api/games/[gameId]/results/route";

interface CapturedResponse {
  body: Record<string, unknown>;
  status: number;
}

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

async function capture(responsePromise: Promise<unknown>): Promise<CapturedResponse> {
  return (await responsePromise) as unknown as CapturedResponse;
}

const GAME_PARAMS = { params: { gameId: "123456" } };
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

const VALID_QUESTION = {
  text: "¿Cuál es la capital de Francia?",
  options: ["París", "Londres", "Berlín", "Madrid"],
  correctAnswer: 0,
};

function gameFixture(overrides: Partial<Game> = {}): Game {
  return {
    id: "123456",
    name: "Geografía",
    questions: [
      {
        id: "q1",
        text: "¿Cuál es la capital de Francia?",
        options: ["París", "Londres", "Berlín", "Madrid"],
        correctAnswer: 0,
        image: null,
      },
    ],
    createdAt: CREATED_AT,
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
    id: "p1",
    name: "Ana",
    gameId: "123456",
    answers: {},
    score: 0,
    joinedAt: CREATED_AT,
    ...overrides,
  };
}

describe("handlers de juego — smoke de happy path (US-12)", () => {
  function setupFake(seed: readonly Game[] = []): void {
    getContainerMock.mockReturnValue(
      createFakeContainer({ seed, gameCodes: ["123456"] }).container
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupFake();
  });

  it("POST /api/games responde 201 con { game }", async () => {
    const response = await capture(
      createGame(fakeRequest({ name: "Geografía", questions: [VALID_QUESTION] }))
    );

    expect(response.status).toBe(201);
    expect(Object.keys(response.body)).toEqual(["game"]);
  });

  it("GET /api/games responde 200 con { games }", async () => {
    setupFake([gameFixture()]);

    const response = await capture(listGames());

    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(["games"]);
  });

  it("POST /api/games/join responde 200 con { player, game }", async () => {
    setupFake([gameFixture()]);

    const response = await capture(
      joinGame(fakeRequest({ gameId: "123456", playerName: "Alice" }))
    );

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(["game", "player"]);
  });

  it("GET /api/games/[gameId] responde 200 con { game }", async () => {
    setupFake([gameFixture()]);

    const response = await capture(getGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(["game"]);
  });

  it("POST /api/games/[gameId]/start responde 200 con { game }", async () => {
    setupFake([gameFixture({ players: [playerFixture()] })]);

    const response = await capture(startGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(["game"]);
  });

  it("POST /api/games/[gameId]/finish responde 200 con { success: true }", async () => {
    setupFake([gameFixture({ status: "active" })]);

    const response = await capture(finishGame({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(Object.keys(response.body)).toEqual(["success"]);
  });

  it("GET /api/games/[gameId]/results responde 200 con { results }", async () => {
    setupFake([
      gameFixture({
        status: "finished",
        players: [playerFixture()],
      }),
    ]);

    const response = await capture(getResults({} as Request, GAME_PARAMS));

    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(["results"]);
  });
});
