import type { Game } from "../../domain/game";
import type { Player, PlayerAvatar } from "../../domain/player";
import {
  ConflictError,
  GameLockedError,
  NotFoundError,
  ValidationError,
} from "../../domain/errors";
import type { GameRepository } from "../ports/game-repository";
import type { IdGenerator } from "../ports/id-generator";
import type { Clock } from "../ports/clock";

// US-11 §5: alta de jugador en una partida `waiting`. Orden legacy exacto:
// validación → 404 → status → locked → duplicado → alta con avatar default.
// El 403 de "Game entry is locked" es un override de la ruta US-12, no del core.

export interface JoinGameInput {
  gameId: string;
  playerName: string;
  avatar?: PlayerAvatar;
}

export interface JoinGameDeps {
  games: GameRepository;
  ids: IdGenerator;
  clock: Clock;
}

export interface JoinGameOutput {
  player: Player;
  game: Game;
}

export interface JoinGameUseCase {
  execute(input: JoinGameInput): Promise<JoinGameOutput>;
}

export function createJoinGameUseCase(deps: JoinGameDeps): JoinGameUseCase {
  return {
    async execute(input: JoinGameInput): Promise<JoinGameOutput> {
      if (!input.gameId || !input.playerName) {
        throw new ValidationError("Game ID and player name are required");
      }

      const game = await deps.games.findById(input.gameId);
      if (!game) {
        throw new NotFoundError("Game not found");
      }

      if (game.status !== "waiting") {
        throw new ConflictError("Game is no longer accepting players");
      }

      if (game.locked) {
        throw new GameLockedError("Game entry is locked");
      }

      const normalizedName = input.playerName.toLowerCase();
      const nameTaken = game.players.some(
        (player) => player.name.toLowerCase() === normalizedName
      );
      if (nameTaken) {
        throw new ConflictError("Player name is already taken in this game");
      }

      const player: Player = {
        id: deps.ids.next(),
        name: input.playerName,
        gameId: game.id,
        answers: {},
        score: 0,
        joinedAt: new Date(deps.clock.now()),
        avatar: input.avatar ?? { seed: input.playerName },
      };

      const updated = await deps.games.addPlayer(game.id, player);
      if (!updated) {
        throw new Error("Failed to add player: game not found");
      }

      return { player, game: updated };
    },
  };
}
