import type { Game } from "../../domain/game";
import type { GameRepository } from "../ports/game-repository";

// US-11 §5: listado de partidas recientes. Sin lógica propia: el orden
// (createdAt desc) es responsabilidad del repositorio.

export interface ListGamesDeps {
  games: GameRepository;
}

export interface ListGamesUseCase {
  execute(): Promise<Game[]>;
}

export function createListGamesUseCase(deps: ListGamesDeps): ListGamesUseCase {
  return {
    execute: () => deps.games.listRecent(),
  };
}
