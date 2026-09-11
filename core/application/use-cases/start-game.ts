import type { Game } from "../../domain/game";
import { ConflictError, NotFoundError } from "../../domain/errors";
import type { GameRepository } from "../ports/game-repository";
import type { Clock } from "../ports/clock";

// US-11 §5: arranque de partida. El `Game` del dominio ya trae el
// `questionTimeLimit` normalizado por `toDomain` (fallback 20000), por eso el
// patch NO reescribe `questionTimeLimit`: igual que el legacy, conserva el
// valor existente y deja que el fallback viva en un solo lugar.

export interface StartGameInput {
  gameId: string;
}

export interface StartGameDeps {
  games: GameRepository;
  clock: Clock;
}

export interface StartGameUseCase {
  execute(input: StartGameInput): Promise<Game>;
}

export function createStartGameUseCase(deps: StartGameDeps): StartGameUseCase {
  return {
    async execute({ gameId }: StartGameInput): Promise<Game> {
      const game = await deps.games.findById(gameId);
      if (!game) {
        throw new NotFoundError("Game not found");
      }

      if (game.status !== "waiting") {
        throw new ConflictError("Game cannot be started");
      }

      if (game.players.length === 0) {
        throw new ConflictError("Cannot start game with no players");
      }

      const updated = await deps.games.setStatusAndIndex(game.id, {
        status: "active",
        currentQuestionIndex: 0,
        currentQuestionStartTime: deps.clock.now(),
      });
      if (!updated) {
        throw new Error("Failed to start game: game not found");
      }

      return updated;
    },
  };
}
