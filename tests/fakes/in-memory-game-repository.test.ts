import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { Game } from "@/core/domain/game";
import type {
  GameProgressUpdate,
  NewGame,
} from "@/core/application/ports/game-repository";
import type { Player } from "@/core/domain/player";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";

// US-11 §3.2: contrato del fake que usan los casos de uso. Verifica el espejo
// semántico del repo Mongo (ids sintéticos, nulls, orden, unicidad y clonado)
// sin Mongo ni red.

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");

function gameFixture(overrides: Partial<Game> = {}): Game {
  return {
    id: "111111",
    name: "Partida",
    questions: [
      {
        id: "q-fija",
        text: "Pregunta",
        options: ["A", "B", "C", "D"],
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

function newGameFixture(overrides: Partial<NewGame> = {}): NewGame {
  return {
    ...gameFixture(),
    questions: [
      {
        text: "Pregunta 1",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        image: null,
      },
      {
        text: "Pregunta 2",
        options: ["A", "B", "C", "D"],
        correctAnswer: 1,
      },
    ],
    ...overrides,
  };
}

function playerFixture(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Ana",
    gameId: "111111",
    answers: { "q-fija": 0 },
    score: 0,
    joinedAt: JOINED_AT,
    ...overrides,
  };
}

describe("tests/fakes/in-memory-game-repository", () => {
  it("sin partidas: existsByCode false, findById null y listRecent []", async () => {
    const repo = createInMemoryGameRepository();

    await expect(repo.existsByCode("111111")).resolves.toBe(false);
    await expect(repo.findById("111111")).resolves.toBeNull();
    await expect(repo.listRecent()).resolves.toEqual([]);
  });

  it("create sintetiza ids de pregunta, normaliza image y queda registrado", async () => {
    const repo = createInMemoryGameRepository();

    const created = await repo.create(newGameFixture());

    expect(created.id).toBe("111111");
    expect(created.questions.map((q) => q.id)).toEqual(["q-1", "q-2"]);
    expect(created.questions[1].image).toBeNull();
    await expect(repo.existsByCode("111111")).resolves.toBe(true);

    const stored = await repo.findById("111111");
    expect(stored).toEqual(created);

    // La salida es un clon: mutarla no contamina el store.
    created.questions[0].text = "mutado";
    expect((await repo.findById("111111"))?.questions[0].text).toBe(
      "Pregunta 1"
    );
  });

  it("create con un id existente falla como el índice unique del schema", async () => {
    const repo = createInMemoryGameRepository([gameFixture()]);

    await expect(repo.create(newGameFixture())).rejects.toThrow(
      'Duplicate gameCode "111111" (unique index)'
    );
  });

  it("addPlayer agrega un clon y devuelve null si la partida no existe", async () => {
    const repo = createInMemoryGameRepository([gameFixture()]);
    const player = playerFixture();

    const updated = await repo.addPlayer("111111", player);

    expect(updated?.players).toHaveLength(1);
    expect(updated?.players[0]).toEqual(player);

    player.answers["q-fija"] = 9;
    expect((await repo.findById("111111"))?.players[0].answers).toEqual({
      "q-fija": 0,
    });

    await expect(repo.addPlayer("999999", player)).resolves.toBeNull();
  });

  it("setStatusAndIndex parchea solo lo provisto y devuelve null si no existe", async () => {
    const repo = createInMemoryGameRepository([gameFixture()]);
    const update: GameProgressUpdate = {
      status: "active",
      currentQuestionIndex: 2,
      currentQuestionStartTime: 1234,
    };

    const updated = await repo.setStatusAndIndex("111111", update);

    expect(updated).toMatchObject({
      status: "active",
      currentQuestionIndex: 2,
      currentQuestionStartTime: 1234,
      questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    });

    const finished = await repo.setStatusAndIndex("111111", {
      status: "finished",
      currentQuestionIndex: -1,
    });
    expect(finished?.currentQuestionStartTime).toBe(1234);

    await expect(
      repo.setStatusAndIndex("999999", {
        status: "finished",
        currentQuestionIndex: -1,
      })
    ).resolves.toBeNull();
  });

  it("listRecent ordena desc por createdAt y no comparte referencias", async () => {
    const older = gameFixture({
      id: "111111",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newer = gameFixture({
      id: "222222",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const repo = createInMemoryGameRepository([older, newer]);

    const recent = await repo.listRecent();

    expect(recent.map((g) => g.id)).toEqual(["222222", "111111"]);
    recent[0].name = "mutado";
    recent[0].createdAt.setTime(0);
    const again = await repo.listRecent();
    expect(again[0].name).toBe("Partida");
    expect(again[0].createdAt).toEqual(newer.createdAt);
  });
});
