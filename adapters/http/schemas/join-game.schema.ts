import { z } from "zod";
import { parseBody } from "./parse-body";

export const playerAvatarSchema = z.object({
  seed: z.string(),
  accessories: z.array(z.string()).optional(),
});

/**
 * `gameId`/`playerName` son opcionales a propósito (D4 US-11): la requeridización
 * vive en `join-game.execute` y produce `"Game ID and player name are required"`.
 * El borde solo valida tipos y `avatar`; la ruta normaliza `?? ""` antes del caso de uso.
 */
export const joinGameSchema = z.object({
  gameId: z.string().optional(),
  playerName: z.string().optional(),
  avatar: playerAvatarSchema.optional(),
});

export type JoinGameBody = z.infer<typeof joinGameSchema>;

export function parseJoinGameBody(raw: unknown): JoinGameBody {
  return parseBody(joinGameSchema, raw, "Game ID and player name are required");
}
