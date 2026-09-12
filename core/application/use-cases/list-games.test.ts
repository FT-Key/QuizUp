import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { createListGamesUseCase } from "@/core/application/use-cases/list-games";
import type { Game } from "@/core/domain/game";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";

// US-11 §5: caso de uso ListGames. Sin lógica: delega el orden (createdAt
// desc) en el repositorio, igual que `GET /api/games` legacy.

function gameFixture(id: string, createdAt: Date): Game {
  return {
    id,
    name: `Partida ${id}`,
    questions: [],
    createdAt,
    creatorId: "creator-1",
    status: "waiting",
    currentQuestionIndex: 0,
    players: [],
    currentQuestionStartTime: 0,
    questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    locked: false,
  };
}

describe("core/application/use-cases/list-games", () => {
  it("devuelve las partidas del repo en su orden (createdAt desc)", async () => {
    const older = gameFixture("111111", new Date("2026-01-01T00:00:00.000Z"));
    const newer = gameFixture("222222", new Date("2026-02-01T00:00:00.000Z"));
    const games = createInMemoryGameRepository([older, newer]);
    const listRecentSpy = vi.spyOn(games, "listRecent");
    const useCase = createListGamesUseCase({ games });

    const result = await useCase.execute();

    expect(listRecentSpy).toHaveBeenCalledTimes(1);
    expect(result.map((game) => game.id)).toEqual(["222222", "111111"]);
    expect(result[0]).toEqual(newer);
  });

  it("sin partidas devuelve un array vacío", async () => {
    const useCase = createListGamesUseCase({
      games: createInMemoryGameRepository(),
    });

    await expect(useCase.execute()).resolves.toEqual([]);
  });
});
