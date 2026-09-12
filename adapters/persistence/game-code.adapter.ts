import type { GameCodeGenerator } from "@/core/application/ports/game-code-generator";

/**
 * Generador de códigos de partida del adaptador.
 * Fórmula y rango idénticos al legacy `lib/gameCode.ts` (100000–999999);
 * la unicidad la verifica el caso de uso contra `GameRepository`.
 */
export function createGameCodeGenerator(): GameCodeGenerator {
  return {
    generate: () => Math.floor(100000 + Math.random() * 900000).toString(),
  };
}
