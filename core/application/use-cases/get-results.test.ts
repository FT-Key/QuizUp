import { describe, expect, it } from "vitest";
import { toHttpError } from "@/adapters/http/error-mapper";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { createGetResultsUseCase } from "@/core/application/use-cases/get-results";
import type { Game } from "@/core/domain/game";
import { NotFoundError } from "@/core/domain/errors";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";

// US-11 §5/§7 + US-10 D3: caso de uso GetResults. Paridad con
// `legacy-results-contract.test.ts` (percentage crudo 1/3 y 2/3) y con
// `legacy-error-contract.test.ts` (404 para miss y para no-`finished`).

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

function questionFixture(id: string, correctAnswer: number) {
  return {
    id,
    text: `Pregunta ${id}`,
    options: ["A", "B", "C", "D"] as [string, string, string, string],
    correctAnswer,
    image: null,
  };
}

function finishedGameFixture(): Game {
  return {
    id: "123456",
    name: "Geografía",
    questions: [
      questionFixture("q1", 0),
      questionFixture("q2", 1),
      questionFixture("q3", 2),
    ],
    createdAt: CREATED_AT,
    creatorId: "creator-1",
    status: "finished",
    currentQuestionIndex: 2,
    players: [
      {
        // 1/3 aciertos: percentage crudo 33.333…
        id: "p1",
        name: "Ana",
        gameId: "123456",
        answers: { q1: 0, q2: 9, q3: 9 },
        score: 100,
        joinedAt: CREATED_AT,
      },
      {
        // 2/3 aciertos: percentage crudo 66.666…; averageScore (100+101)/2.
        id: "p2",
        name: "Beto",
        gameId: "123456",
        answers: { q1: 0, q2: 1 },
        score: 101,
        joinedAt: CREATED_AT,
      },
    ],
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

describe("core/application/use-cases/get-results", () => {
  it("devuelve el cálculo CRUDO del dominio (percentage sin redondear)", async () => {
    const useCase = createGetResultsUseCase({
      games: createInMemoryGameRepository([finishedGameFixture()]),
    });

    const results = await useCase.execute({ gameId: "123456" });

    expect(results.gameId).toBe("123456");
    expect(results.totalPlayers).toBe(2);
    expect(results.totalQuestions).toBe(3);
    expect(results.leaderboard[0]).toMatchObject({
      playerId: "p1",
      name: "Ana",
      score: 100,
      correctAnswers: 1,
      totalQuestions: 3,
    });
    expect(results.leaderboard[0].percentage).toBeCloseTo(33.33333333333333);
    expect(results.leaderboard[0].percentage).not.toBe(33);
    expect(results.leaderboard[1].percentage).toBeCloseTo(66.66666666666666);
    expect(results.leaderboard[1].percentage).not.toBe(67);
    // `averageScore` tampoco se redondea (100 + 101) / 2.
    expect(results.averageScore).toBe(100.5);
    expect(results.questionResults).toHaveLength(3);
  });

  it("una partida active (no finished) da 404 con el mensaje legacy", async () => {
    const game = { ...finishedGameFixture(), status: "active" as const };
    const useCase = createGetResultsUseCase({
      games: createInMemoryGameRepository([game]),
    });

    const error = await rejection(useCase.execute({ gameId: "123456" }));

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Game not found or no results available",
    });
    expect(toHttpError(error)).toEqual({
      status: 404,
      message: "Game not found or no results available",
    });
  });

  it("una partida inexistente da el mismo 404", async () => {
    const useCase = createGetResultsUseCase({
      games: createInMemoryGameRepository(),
    });

    const error = await rejection(useCase.execute({ gameId: "000000" }));

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Game not found or no results available",
    });
    expect(toHttpError(error).status).toBe(404);
  });
});
