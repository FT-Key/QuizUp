import type { Clock } from "@/core/application/ports/clock";
import type { GameCodeGenerator } from "@/core/application/ports/game-code-generator";
import type { GameRepository } from "@/core/application/ports/game-repository";
import type { IdGenerator } from "@/core/application/ports/id-generator";
import type { Logger } from "@/core/application/ports/logger";
import { createGameCodeGenerator } from "@/adapters/persistence/game-code.adapter";
import { connectToMongo } from "@/adapters/persistence/mongo/connection";
import { createMongoGameRepository } from "@/adapters/persistence/mongo/game-repository.mongo";
import { createSystemClock } from "@/adapters/system/clock";
import { createUuidGenerator } from "@/adapters/system/id-generator";
import {
  createCreateGameUseCase,
  type CreateGameUseCase,
} from "@/core/application/use-cases/create-game";
import {
  createFinishGameUseCase,
  type FinishGameUseCase,
} from "@/core/application/use-cases/finish-game";
import {
  createGetGameUseCase,
  type GetGameUseCase,
} from "@/core/application/use-cases/get-game";
import {
  createGetResultsUseCase,
  type GetResultsUseCase,
} from "@/core/application/use-cases/get-results";
import {
  createJoinGameUseCase,
  type JoinGameUseCase,
} from "@/core/application/use-cases/join-game";
import {
  createListGamesUseCase,
  type ListGamesUseCase,
} from "@/core/application/use-cases/list-games";
import {
  createStartGameUseCase,
  type StartGameUseCase,
} from "@/core/application/use-cases/start-game";
import { type AppConfig, loadConfig } from "./config";
import { createLogger } from "./logger";

/**
 * Casos de uso disponibles en el servidor Next (US-11). Las rutas los consumen
 * vía `getContainer()` en US-12; los componentes cliente NUNCA importan esto.
 */
export interface UseCases {
  readonly createGame: CreateGameUseCase;
  readonly listGames: ListGamesUseCase;
  readonly getGame: GetGameUseCase;
  readonly joinGame: JoinGameUseCase;
  readonly startGame: StartGameUseCase;
  readonly finishGame: FinishGameUseCase;
  readonly getResults: GetResultsUseCase;
}

/**
 * Composition root del servidor Next: único lugar que conoce adapters e infra.
 * Solo servidor: NUNCA importar desde componentes/hooks cliente.
 */
export interface Container {
  readonly logger: Logger;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly gameCodes: GameCodeGenerator;
  readonly games: GameRepository;
  readonly useCases: UseCases;
}

/** Construcción pura del grafo: sin singletons, sin IO, sin env. */
export function createContainer(config: AppConfig): Container {
  const logger = createLogger({ level: config.logLevel, context: "quizup-next" });
  const clock = createSystemClock();
  const ids = createUuidGenerator();
  const gameCodes = createGameCodeGenerator();
  // La conexión es lazy: `connect` solo se invoca dentro de cada método del repo.
  const games = createMongoGameRepository({
    connect: () => connectToMongo(config.mongoUri),
  });
  const useCases: UseCases = {
    createGame: createCreateGameUseCase({ games, gameCodes, ids, clock }),
    listGames: createListGamesUseCase({ games }),
    getGame: createGetGameUseCase({ games }),
    joinGame: createJoinGameUseCase({ games, ids, clock }),
    startGame: createStartGameUseCase({ games, clock }),
    finishGame: createFinishGameUseCase({ games }),
    getResults: createGetResultsUseCase({ games }),
  };

  return { logger, clock, ids, gameCodes, games, useCases };
}

let cached: Container | null = null;

/**
 * Container lazy por proceso: no evalúa env ni construye nada al importarse.
 * La primera llamada crea el grafo con `loadConfig()` y lo memoiza.
 * No conecta a Mongo: la conexión ocurre en la primera llamada a un método
 * del repositorio (`games.*`).
 */
export function getContainer(): Container {
  if (!cached) {
    cached = createContainer(loadConfig());
  }
  return cached;
}
