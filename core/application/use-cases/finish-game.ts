import type { Game } from "../../domain/game";
import { GAME_STATUS } from "../../domain/game/constants";
import { ConflictError, NotFoundError } from "../../domain/errors";
import type { GameRepository } from "../ports/game-repository";

// US-11 §5: fin de partida. Conserva el quirk legacy: sin preguntas el índice
// queda en -1 (`questions.length - 1`).

export interface FinishGameDeps {
  games: GameRepository;
}

export interface FinishGameUseCase {
  execute(input: { gameId: string }): Promise<{ success: true }>;
}

export function createFinishGameUseCase(deps: FinishGameDeps): FinishGameUseCase {
  return {
    async execute({ gameId }: { gameId: string }): Promise<{ success: true }> {
      const game = await deps.games.findById(gameId);
      if (!game) {
        throw new NotFoundError("Game not found");
      }

      if (game.status !== GAME_STATUS.ACTIVE) {
        throw new ConflictError("Game cannot be finished");
      }

      const updated = await deps.games.setStatusAndIndex(game.id, {
        status: GAME_STATUS.FINISHED,
        currentQuestionIndex: game.questions.length - 1,
      });
      if (!updated) {
        throw new Error("Failed to finish game: game not found");
      }

      return { success: true };
    },
  };
}
