import { describe, expect, it, vi } from "vitest";
import { toHttpError } from "@/adapters/http/error-mapper";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { createStartGameUseCase } from "@/core/application/use-cases/start-game";
import type { Game } from "@/core/domain/game";
import { ConflictError, NotFoundError } from "@/core/domain/errors";
import type { Player } from "@/core/domain/player";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";
import { fixedClock } from "@/tests/fakes/system";

// US-11 §5/§7: caso de uso StartGame. Paridad con
// `legacy-game-lifecycle-contract.test.ts`: 404 `Game not found`, 400
// `Game cannot be started` / `Cannot start game with no players`, y patch
// `{ status: active, currentQuestionIndex: 0, currentQuestionStartTime: now }`
// sin reescribir `questionTimeLimit` (ya normalizado en el dominio).

const NOW = new Date("2026-03-01T10:00:00.000Z").getTime();
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");

function playerFixture(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Ana",
    gameId: "123456",
    answers: {},
    score: 0,
    joinedAt: JOINED_AT,
    ...overrides,
  };
}

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
        image: null,
      },
    ],
    createdAt: CREATED_AT,
    creatorId: "creator-1",
    status: "waiting",
    currentQuestionIndex: 3,
    players: [playerFixture()],
    currentQuestionStartTime: 0,
    questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    locked: false,
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("Se esperaba un rechazo");
    },
    (error: unknown) => error
  );
}

describe("core/application/use-cases/start-game", () => {
  it("activa la partida en la pregunta 0 con el reloj inyectado y sin pisar el timeLimit", async () => {
    const games = createInMemoryGameRepository([gameFixture()]);
    const updateSpy = vi.spyOn(games, "setStatusAndIndex");
    const useCase = createStartGameUseCase({ games, clock: fixedClock(NOW) });

    const updated = await useCase.execute({ gameId: "123456" });

    // El patch es EXACTAMENTE el del legacy: sin `questionTimeLimit`.
    expect(updateSpy).toHaveBeenCalledWith("123456", {
      status: "active",
      currentQuestionIndex: 0,
      currentQuestionStartTime: NOW,
    });
    expect(updated).toMatchObject({
      id: "123456",
      status: "active",
      currentQuestionIndex: 0,
      currentQuestionStartTime: NOW,
      questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    });
    await expect(games.findById("123456")).resolves.toMatchObject({
      status: "active",
      currentQuestionIndex: 0,
      currentQuestionStartTime: NOW,
    });
  });

  it("conserva el questionTimeLimit ya definido en el dominio (30000)", async () => {
    const games = createInMemoryGameRepository([
      gameFixture({ questionTimeLimit: 30000 }),
    ]);
    const useCase = createStartGameUseCase({ games, clock: fixedClock(NOW) });

    const updated = await useCase.execute({ gameId: "123456" });

    expect(updated.questionTimeLimit).toBe(30000);
  });

  it("una partida inexistente lanza NotFoundError 404", async () => {
    const useCase = createStartGameUseCase({
      games: createInMemoryGameRepository(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(useCase.execute({ gameId: "000000" }));

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ code: "NOT_FOUND", message: "Game not found" });
    expect(toHttpError(error)).toEqual({ status: 404, message: "Game not found" });
  });

  it("una partida que no está waiting lanza ConflictError 400", async () => {
    const useCase = createStartGameUseCase({
      games: createInMemoryGameRepository([gameFixture({ status: "active" })]),
      clock: fixedClock(NOW),
    });

    const error = await rejection(useCase.execute({ gameId: "123456" }));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "Game cannot be started",
    });
    expect(toHttpError(error)).toEqual({
      status: 400,
      message: "Game cannot be started",
    });
  });

  it("sin jugadores lanza ConflictError 400", async () => {
    const useCase = createStartGameUseCase({
      games: createInMemoryGameRepository([gameFixture({ players: [] })]),
      clock: fixedClock(NOW),
    });

    const error = await rejection(useCase.execute({ gameId: "123456" }));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "Cannot start game with no players",
    });
    expect(toHttpError(error)).toEqual({
      status: 400,
      message: "Cannot start game with no players",
    });
  });

  it("si el repo no encuentra la partida al parchear lanza Error crudo (→ 500)", async () => {
    const games = createInMemoryGameRepository([gameFixture()]);
    vi.spyOn(games, "setStatusAndIndex").mockResolvedValue(null);
    const useCase = createStartGameUseCase({ games, clock: fixedClock(NOW) });

    const error = await rejection(useCase.execute({ gameId: "123456" }));

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Failed to start game: game not found");
    expect(toHttpError(error)).toEqual({
      status: 500,
      message: "Internal server error",
    });
  });
});
