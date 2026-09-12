import { GAME_STATUS } from "../../domain/game/constants";
import { NotFoundError } from "../../domain/errors";
import {
  calculateResults,
  type GameResults,
} from "../../domain/results/results-calculator";
import type { GameRepository } from "../ports/game-repository";

// US-11 §5 + US-10 D3: solo una partida `finished` tiene resultados. El
// `percentage` sale CRUDO del calculador único; el redondeo de presentación
// vive en `toResultsDto` (mapper REST).

export interface GetResultsDeps {
  games: GameRepository;
}

export interface GetResultsUseCase {
  execute(input: { gameId: string }): Promise<GameResults>;
}

export function createGetResultsUseCase(deps: GetResultsDeps): GetResultsUseCase {
  return {
    async execute({ gameId }: { gameId: string }): Promise<GameResults> {
      const game = await deps.games.findById(gameId);
      if (!game || game.status !== GAME_STATUS.FINISHED) {
        throw new NotFoundError("Game not found or no results available");
      }

      return calculateResults(game);
    },
  };
}
