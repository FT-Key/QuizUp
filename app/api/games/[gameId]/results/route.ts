import { NextResponse } from "next/server";
import { toResultsDto } from "@/adapters/persistence/mongo/game.mapper";
import { handle } from "@/adapters/http/handle";
import { ok } from "@/adapters/http/next-response";
import { getContainer } from "@/infra/container";

interface Params {
  params: { gameId: string };
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  return handle(async () => {
    const results = await getContainer().useCases.getResults.execute({
      gameId: params.gameId,
    });
    return ok({ results: toResultsDto(results) });
  }, "Error fetching results:");
}
