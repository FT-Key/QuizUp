import { NextResponse } from "next/server";
import { handle } from "@/adapters/http/handle";
import { ok } from "@/adapters/http/next-response";
import { getContainer } from "@/infra/container";

interface Params {
  params: { gameId: string };
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  return handle(async () => {
    const result = await getContainer().useCases.finishGame.execute({
      gameId: params.gameId,
    });
    return ok(result);
  }, "Error finishing game:");
}
