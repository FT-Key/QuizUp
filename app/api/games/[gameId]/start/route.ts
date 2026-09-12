import { NextResponse } from "next/server";
import { toStartGameDto } from "@/adapters/persistence/mongo/game.mapper";
import { handle } from "@/adapters/http/handle";
import { ok } from "@/adapters/http/next-response";
import { getContainer } from "@/infra/container";

interface Params {
  params: { gameId: string };
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  return handle(async () => {
    const game = await getContainer().useCases.startGame.execute({
      gameId: params.gameId,
    });
    return ok({ game: toStartGameDto(game) });
  }, "Error starting game:");
}
