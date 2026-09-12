import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { Game } from "../../domain/game";
import { ConflictError, NotFoundError } from "../../domain/errors";
import type { GameRepository } from "../ports/game-repository";
import type { Clock } from "../ports/clock";

// US-11 §5: arranque de partida. El patch espeja al legacy
// (`app/api/games/[gameId]/start/route.ts`): fija `questionTimeLimit` al valor
// ya normalizado del dominio con fallback `DEFAULT_TIME_LIMIT_MS` (20000), de
// modo que la partida active quede persistida con un límite explícito, sin
// depender de la normalización de `toDomain`.

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
        questionTimeLimit: game.questionTimeLimit || DEFAULT_TIME_LIMIT_MS,
      });
      if (!updated) {
        throw new Error("Failed to start game: game not found");
      }

      return updated;
    },
  };
}
