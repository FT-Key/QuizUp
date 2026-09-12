import { describe, expect, it } from "vitest";
import { toHttpError } from "@/adapters/http/error-mapper";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { createGetGameUseCase } from "@/core/application/use-cases/get-game";
import type { Game } from "@/core/domain/game";
import { NotFoundError } from "@/core/domain/errors";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";

// US-11 §5: caso de uso GetGame. Paridad con `GET /api/games/[gameId]` de
// `legacy-error-contract.test.ts`: miss → 404 `Game not found`.

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

function gameFixture(id: string): Game {
  return {
    id,
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
    currentQuestionIndex: 0,
    players: [],
    currentQuestionStartTime: 0,
    questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    locked: false,
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

describe("core/application/use-cases/get-game", () => {
  it("devuelve la partida encontrada por id", async () => {
    const useCase = createGetGameUseCase({
      games: createInMemoryGameRepository([gameFixture("123456")]),
    });

    const game = await useCase.execute({ gameId: "123456" });

    expect(game).toEqual(gameFixture("123456"));
  });

  it("miss lanza NotFoundError 404 con el mensaje legacy", async () => {
    const useCase = createGetGameUseCase({
      games: createInMemoryGameRepository(),
    });

    const error = await rejection(useCase.execute({ gameId: "000000" }));

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ code: "NOT_FOUND", message: "Game not found" });
    expect(toHttpError(error)).toEqual({
      status: 404,
      message: "Game not found",
    });
  });
});
