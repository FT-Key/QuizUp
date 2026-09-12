import type { Container } from "@/infra/container";
import type { GameRepository } from "@/core/application/ports/game-repository";
import type { Game } from "@/core/domain/game";
import { createCreateGameUseCase } from "@/core/application/use-cases/create-game";
import { createFinishGameUseCase } from "@/core/application/use-cases/finish-game";
import { createGetGameUseCase } from "@/core/application/use-cases/get-game";
import { createGetResultsUseCase } from "@/core/application/use-cases/get-results";
import { createJoinGameUseCase } from "@/core/application/use-cases/join-game";
import { createListGamesUseCase } from "@/core/application/use-cases/list-games";
import { createStartGameUseCase } from "@/core/application/use-cases/start-game";
import { createLogger } from "@/infra/logger";
import { createInMemoryGameRepository } from "./in-memory-game-repository";
import { fixedClock, sequentialIds, sequenceGameCodes } from "./system";

// US-12 §2.1: container fake para los tests de rutas HTTP (seam
// `vi.mock("@/infra/container")`). Construye los 7 casos de uso reales sobre
// dobles deterministas. Solo importa TIPOS de `@/infra/container`: si el test
// mockea ese módulo, este helper sigue funcionando (nunca lo ejecuta).

export interface FakeContainerOptions {
  seed?: readonly Game[];
  now?: number; // default 0 (fixedClock)
  gameCodes?: readonly string[]; // default ["123456"]
  idPrefix?: string; // default "id"
}

export interface FakeContainerResult {
  container: Container;
  /** Repo en memoria para seed/asserts (misma instancia que usa el container). */
  games: GameRepository;
}

export function createFakeContainer(
  options: FakeContainerOptions = {}
): FakeContainerResult {
  const clock = fixedClock(options.now ?? 0);
  const ids = sequentialIds(options.idPrefix ?? "id");
  const games = createInMemoryGameRepository([...(options.seed ?? [])]);
  const gameCodes = sequenceGameCodes(options.gameCodes ?? ["123456"]);

  const useCases = {
    createGame: createCreateGameUseCase({ games, gameCodes, ids, clock }),
    listGames: createListGamesUseCase({ games }),
    getGame: createGetGameUseCase({ games }),
    joinGame: createJoinGameUseCase({ games, ids, clock }),
    startGame: createStartGameUseCase({ games, clock }),
    finishGame: createFinishGameUseCase({ games }),
    getResults: createGetResultsUseCase({ games }),
  };

  const container: Container = {
    logger: createLogger({ level: "error", context: "test" }),
    clock,
    ids,
    gameCodes,
    games,
    useCases,
  };

  return { container, games };
}
