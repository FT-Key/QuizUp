import { type NextRequest, NextResponse } from "next/server";
import { toJoinGameDto, toPlayerDto } from "@/adapters/persistence/mongo/game.mapper";
import { handle } from "@/adapters/http/handle";
import { error, ok } from "@/adapters/http/next-response";
import { parseJoinGameBody } from "@/adapters/http/schemas/join-game.schema";
import { GameLockedError } from "@/core/domain/errors";
import { getContainer } from "@/infra/container";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(async () => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      // best-effort: body no-JSON ⇒ 400 (simetría con POST /api/games)
      return error("Invalid JSON body", 400);
    }

    const body = parseJoinGameBody(raw);
    try {
      const { player, game } = await getContainer().useCases.joinGame.execute({
        gameId: body.gameId ?? "",
        playerName: body.playerName ?? "",
        avatar: body.avatar,
      });
      return ok({ player: toPlayerDto(player), game: toJoinGameDto(game) });
    } catch (cause) {
      if (cause instanceof GameLockedError) return error(cause, 403);
      throw cause;
    }
  }, "Error joining game:");
}
