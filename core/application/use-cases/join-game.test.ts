import { describe, expect, it, vi } from "vitest";
import { toHttpError } from "@/adapters/http/error-mapper";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { createJoinGameUseCase } from "@/core/application/use-cases/join-game";
import type { Game } from "@/core/domain/game";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/core/domain/errors";
import type { Player } from "@/core/domain/player";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";
import { fixedClock, sequentialIds } from "@/tests/fakes/system";

// US-11 §5/§7: caso de uso JoinGame. Paridad con los errores de
// `legacy-error-contract.test.ts` (400/403/404) y con el happy path de
// `legacy-game-dto-contract.test.ts` (avatar provisto/default + claves exactas).

const NOW = new Date("2026-03-01T10:00:00.000Z").getTime();
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");

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
    questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    locked: false,
    ...overrides,
  };
}

function playerFixture(overrides: Partial<Player> = {}): Player {
  return {
    id: "p0",
    name: "Zoe",
    gameId: "123456",
    answers: {},
    score: 0,
    joinedAt: JOINED_AT,
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

describe("core/application/use-cases/join-game", () => {
  it("agrega al jugador con avatar default y devuelve player + game actualizado", async () => {
    const games = createInMemoryGameRepository([gameFixture()]);
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const { player, game } = await useCase.execute({
      gameId: "123456",
      playerName: "Alice",
    });

    expect(player).toEqual({
      id: "id-1",
      name: "Alice",
      gameId: "123456",
      answers: {},
      score: 0,
      joinedAt: new Date(NOW),
      avatar: { seed: "Alice" },
    });
    // `game` es el actualizado por el repo (el fake clona al insertar).
    expect(game.players).toHaveLength(1);
    expect(game.players[0]).toEqual(player);
    expect(game.players[0]).not.toBe(player);
  });

  it("un avatar provisto por el cliente se respeta (sin default)", async () => {
    const games = createInMemoryGameRepository([gameFixture()]);
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });
    const avatar = { seed: "custom", accessories: ["glasses"] };

    const { player, game } = await useCase.execute({
      gameId: "123456",
      playerName: "Alice",
      avatar,
    });

    expect(player.avatar).toBe(avatar);
    expect(game.players[0].avatar).toEqual(avatar);
  });

  it("sin gameId o sin playerName lanza ValidationError 400 exacta", async () => {
    const games = createInMemoryGameRepository();
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    for (const input of [
      { gameId: "", playerName: "Alice" },
      { gameId: "123456", playerName: "" },
    ]) {
      const error = await rejection(useCase.execute(input));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({
        code: "VALIDATION",
        message: "Game ID and player name are required",
      });
      expect(toHttpError(error)).toEqual({
        status: 400,
        message: "Game ID and player name are required",
      });
    }
  });

  it("una partida inexistente lanza NotFoundError 404", async () => {
    const useCase = createJoinGameUseCase({
      games: createInMemoryGameRepository(),
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(
      useCase.execute({ gameId: "000000", playerName: "Alice" })
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ code: "NOT_FOUND", message: "Game not found" });
    expect(toHttpError(error)).toEqual({ status: 404, message: "Game not found" });
  });

  it("una partida que no está waiting lanza ConflictError 400", async () => {
    const games = createInMemoryGameRepository([
      gameFixture({ status: "active" }),
    ]);
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(
      useCase.execute({ gameId: "123456", playerName: "Alice" })
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "Game is no longer accepting players",
    });
    expect(toHttpError(error)).toEqual({
      status: 400,
      message: "Game is no longer accepting players",
    });
  });

  it("una partida locked lanza ConflictError; la ruta legacy lo fuerza a 403", async () => {
    const games = createInMemoryGameRepository([
      gameFixture({ locked: true }),
    ]);
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(
      useCase.execute({ gameId: "123456", playerName: "Alice" })
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "Game entry is locked",
    });
    // El error-mapper genérico daría 400; el override `error(err, 403)` de la
    // ruta está congelado en `adapters/http/next-response.test.ts`.
    expect(toHttpError(error)).toEqual({
      status: 400,
      message: "Game entry is locked",
    });
  });

  it("status se evalúa ANTES que locked (partida active + locked da el error de status)", async () => {
    const games = createInMemoryGameRepository([
      gameFixture({ status: "active", locked: true }),
    ]);
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(
      useCase.execute({ gameId: "123456", playerName: "Alice" })
    );

    expect(error).toMatchObject({
      message: "Game is no longer accepting players",
    });
  });

  it("detecta nombre duplicado sin distinguir mayúsculas", async () => {
    const games = createInMemoryGameRepository([
      gameFixture({ players: [playerFixture({ name: "Alice" })] }),
    ]);
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(
      useCase.execute({ gameId: "123456", playerName: "aLiCe" })
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "Player name is already taken in this game",
    });
    expect(toHttpError(error)).toEqual({
      status: 400,
      message: "Player name is already taken in this game",
    });
  });

  it("si el repo no encuentra la partida al insertar lanza Error crudo (→ 500)", async () => {
    const games = createInMemoryGameRepository([gameFixture()]);
    vi.spyOn(games, "addPlayer").mockResolvedValue(null);
    const useCase = createJoinGameUseCase({
      games,
      ids: sequentialIds(),
      clock: fixedClock(NOW),
    });

    const error = await rejection(
      useCase.execute({ gameId: "123456", playerName: "Alice" })
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Failed to add player: game not found");
    expect(toHttpError(error)).toEqual({
      status: 500,
      message: "Internal server error",
    });
  });

  it("mapea cada error al status legacy 400/404 (403 documentado aparte)", () => {
    expect(
      toHttpError(new ValidationError("Game ID and player name are required"))
    ).toEqual({ status: 400, message: "Game ID and player name are required" });
    expect(
      toHttpError(new NotFoundError("Game not found"))
    ).toEqual({ status: 404, message: "Game not found" });
    expect(
      toHttpError(new ConflictError("Game is no longer accepting players"))
    ).toEqual({ status: 400, message: "Game is no longer accepting players" });
    expect(
      toHttpError(new ConflictError("Player name is already taken in this game"))
    ).toEqual({
      status: 400,
      message: "Player name is already taken in this game",
    });
    // `error(err, 403)` para "Game entry is locked" está en next-response.test.ts.
    expect(
      toHttpError(new ConflictError("Game entry is locked"))
    ).toEqual({ status: 400, message: "Game entry is locked" });
  });
});
