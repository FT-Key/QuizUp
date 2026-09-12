import { NextResponse } from "next/server";
import { toGameDto } from "@/adapters/persistence/mongo/game.mapper";
import { handle } from "@/adapters/http/handle";
import { ok } from "@/adapters/http/next-response";
import { getContainer } from "@/infra/container";

interface Params {
  params: { gameId: string };
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  return handle(async () => {
    const game = await getContainer().useCases.getGame.execute({
      gameId: params.gameId,
    });
    return ok({ game: toGameDto(game) });
  }, "Error fetching game:");
}
