import type { Game } from "../../domain/game";
import { NotFoundError } from "../../domain/errors";
import type { GameRepository } from "../ports/game-repository";

// US-11 §5: lectura de una partida por id con el 404 del contrato legacy.

export interface GetGameInput {
  gameId: string;
}

export interface GetGameDeps {
  games: GameRepository;
}

export interface GetGameUseCase {
  execute(input: GetGameInput): Promise<Game>;
}

export function createGetGameUseCase(deps: GetGameDeps): GetGameUseCase {
  return {
    async execute({ gameId }: GetGameInput): Promise<Game> {
      const game = await deps.games.findById(gameId);
      if (!game) {
        throw new NotFoundError("Game not found");
      }
      return game;
    },
  };
}
