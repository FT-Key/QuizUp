import { describe, expect, it, vi } from "vitest";
import { toHttpError } from "@/adapters/http/error-mapper";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { createFinishGameUseCase } from "@/core/application/use-cases/finish-game";
import type { Game } from "@/core/domain/game";
import { ConflictError, NotFoundError } from "@/core/domain/errors";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";

// US-11 §5/§7: caso de uso FinishGame. Paridad con
// `legacy-game-lifecycle-contract.test.ts`: 404 `Game not found`, 400
// `Game cannot be finished`, `{ success: true }` y el quirk `-1` sin preguntas.

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

function gameFixture(overrides: Partial<Game> = {}): Game {
  return {
    id: "123456",
    name: "Geografía",
    questions: [
      {
        id: "q1",
        text: "Pregunta 1",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        image: null,
      },
      {
        id: "q2",
        text: "Pregunta 2",
        options: ["A", "B", "C", "D"],
        correctAnswer: 1,
        image: null,
      },
      {
        id: "q3",
        text: "Pregunta 3",
        options: ["A", "B", "C", "D"],
        correctAnswer: 2,
        image: null,
      },
    ],
    createdAt: CREATED_AT,
    creatorId: "creator-1",
    status: "active",
    currentQuestionIndex: 0,
    players: [],
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

describe("core/application/use-cases/finish-game", () => {
  it("finaliza en la última pregunta y devuelve { success: true }", async () => {
    const games = createInMemoryGameRepository([gameFixture()]);
    const updateSpy = vi.spyOn(games, "setStatusAndIndex");
    const useCase = createFinishGameUseCase({ games });

    const result = await useCase.execute({ gameId: "123456" });

    expect(result).toEqual({ success: true });
    expect(Object.keys(result)).toEqual(["success"]);
    expect(updateSpy).toHaveBeenCalledWith("123456", {
      status: "finished",
      currentQuestionIndex: 2,
    });
    await expect(games.findById("123456")).resolves.toMatchObject({
      status: "finished",
      currentQuestionIndex: 2,
    });
  });

  it("CARACTERIZACIÓN: sin preguntas el índice persistido queda en -1", async () => {
    const games = createInMemoryGameRepository([
      gameFixture({ questions: [] }),
    ]);
    const useCase = createFinishGameUseCase({ games });

    await expect(useCase.execute({ gameId: "123456" })).resolves.toEqual({
      success: true,
    });
    await expect(games.findById("123456")).resolves.toMatchObject({
      status: "finished",
      currentQuestionIndex: -1,
    });
  });

  it("una partida inexistente lanza NotFoundError 404", async () => {
    const useCase = createFinishGameUseCase({
      games: createInMemoryGameRepository(),
    });

    const error = await rejection(useCase.execute({ gameId: "000000" }));

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ code: "NOT_FOUND", message: "Game not found" });
    expect(toHttpError(error)).toEqual({ status: 404, message: "Game not found" });
  });

  it("una partida que no está active lanza ConflictError 400", async () => {
    const useCase = createFinishGameUseCase({
      games: createInMemoryGameRepository([gameFixture({ status: "waiting" })]),
    });

    const error = await rejection(useCase.execute({ gameId: "123456" }));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "Game cannot be finished",
    });
    expect(toHttpError(error)).toEqual({
      status: 400,
      message: "Game cannot be finished",
    });
  });

  it("si el repo no encuentra la partida al parchear lanza Error crudo (→ 500)", async () => {
    const games = createInMemoryGameRepository([gameFixture()]);
    vi.spyOn(games, "setStatusAndIndex").mockResolvedValue(null);
    const useCase = createFinishGameUseCase({ games });

    const error = await rejection(useCase.execute({ gameId: "123456" }));

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Failed to finish game: game not found"
    );
    expect(toHttpError(error)).toEqual({
      status: 500,
      message: "Internal server error",
    });
  });
});
