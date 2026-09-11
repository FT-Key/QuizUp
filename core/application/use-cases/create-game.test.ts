import { describe, expect, it, vi } from "vitest";
import { toHttpError } from "@/adapters/http/error-mapper";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { createCreateGameUseCase } from "@/core/application/use-cases/create-game";
import type { Game } from "@/core/domain/game";
import { ValidationError } from "@/core/domain/errors";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";
import {
  fixedClock,
  sequenceGameCodes,
  sequentialIds,
} from "@/tests/fakes/system";

// US-11 §5/§7: caso de uso CreateGame con fake + dobles deterministas.
// Paridad con `POST /api/games` de `legacy-error-contract.test.ts`:
// `Missing required fields` (400) y, si se agotan los 10 intentos, el Error
// crudo del borde (500 genérico, sin filtrar mensaje).

const NOW = new Date("2026-03-01T10:00:00.000Z").getTime();

const QUESTION = {
  text: "¿Cuál es la capital de Francia?",
  options: ["París", "Londres", "Berlín", "Madrid"] as [
    string,
    string,
    string,
    string,
  ],
  correctAnswer: 2,
};

/** Partida válida solo para poblar colisiones de `gameCode` en el fake. */
function gameFixture(id: string): Game {
  return {
    id,
    name: "Existente",
    questions: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
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

describe("core/application/use-cases/create-game", () => {
  it("crea la partida con el primer código libre y los defaults del contrato", async () => {
    const games = createInMemoryGameRepository();
    const existsSpy = vi.spyOn(games, "existsByCode");
    const useCase = createCreateGameUseCase({
      games,
      gameCodes: sequenceGameCodes(["123456"]),
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const created = await useCase.execute({
      name: "Geografía",
      questions: [QUESTION],
    });

    expect(existsSpy).toHaveBeenCalledTimes(1);
    expect(existsSpy).toHaveBeenCalledWith("123456");
    expect(created).toMatchObject({
      id: "123456",
      name: "Geografía",
      creatorId: "id-1",
      status: "waiting",
      currentQuestionIndex: 0,
      players: [],
      currentQuestionStartTime: 0,
      questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
      locked: false,
    });
    expect(created.createdAt).toEqual(new Date(NOW));
    expect(created.questions).toHaveLength(1);
    expect(created.questions[0].id).toBe("q-1");
    // `create` devuelve el Game persistido por el repo (ids de pregunta reales).
    await expect(games.findById("123456")).resolves.toEqual(created);
  });

  it("respeta el questionTimeLimit provisto por el cliente", async () => {
    const useCase = createCreateGameUseCase({
      games: createInMemoryGameRepository(),
      gameCodes: sequenceGameCodes(["222222"]),
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const created = await useCase.execute({
      name: "Geografía",
      questions: [QUESTION],
      questionTimeLimit: 30000,
    });

    expect(created.questionTimeLimit).toBe(30000);
  });

  it("sin name lanza ValidationError 400 exacta y no consulta el repo", async () => {
    const games = createInMemoryGameRepository();
    const existsSpy = vi.spyOn(games, "existsByCode");
    const useCase = createCreateGameUseCase({
      games,
      gameCodes: sequenceGameCodes(["123456"]),
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(useCase.execute({ name: "", questions: [] }));

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "Missing required fields",
    });
    expect(toHttpError(error)).toEqual({
      status: 400,
      message: "Missing required fields",
    });
    expect(existsSpy).not.toHaveBeenCalled();
  });

  it("reintenta cuando el código ya existe y acepta el siguiente libre", async () => {
    const games = createInMemoryGameRepository([gameFixture("111111")]);
    const existsSpy = vi.spyOn(games, "existsByCode");
    const useCase = createCreateGameUseCase({
      games,
      gameCodes: sequenceGameCodes(["111111", "222222"]),
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const created = await useCase.execute({ name: "Partida", questions: [] });

    expect(existsSpy).toHaveBeenCalledTimes(2);
    expect(created.id).toBe("222222");
  });

  it("agota 10 intentos con el Error crudo legacy (borde → 500 genérico)", async () => {
    const codes = [
      "111111",
      "222222",
      "333333",
      "444444",
      "555555",
      "666666",
      "777777",
      "888888",
      "999999",
      "101010",
    ];
    const games = createInMemoryGameRepository(codes.map(gameFixture));
    const existsSpy = vi.spyOn(games, "existsByCode");
    const useCase = createCreateGameUseCase({
      games,
      gameCodes: sequenceGameCodes(codes),
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(
      useCase.execute({ name: "Partida", questions: [] })
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Failed to generate unique game code after 10 attempts"
    );
    // El borde no filtra el mensaje de un Error crudo: 500 genérico.
    expect(toHttpError(error)).toEqual({
      status: 500,
      message: "Internal server error",
    });
    expect(existsSpy).toHaveBeenCalledTimes(10);
  });
});
