import { type NextRequest, NextResponse } from "next/server";
import { toGameSummaryDto } from "@/adapters/persistence/mongo/game.mapper";
import { handle } from "@/adapters/http/handle";
import { error, ok } from "@/adapters/http/next-response";
import { parseCreateGameBody } from "@/adapters/http/schemas/create-game.schema";
import { getContainer } from "@/infra/container";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(async () => {
    // best-effort: body no-JSON ⇒ 400
    const raw = await request.json().catch(() => null);
    if (!raw) return error("Invalid JSON body", 400);

    const body = parseCreateGameBody(raw);
    const game = await getContainer().useCases.createGame.execute({
      name: body.name ?? "",
      questions: body.questions,
      questionTimeLimit: body.questionTimeLimit,
    });
    return ok({ game: toGameSummaryDto(game) }, 201);
  }, "Error creating game:");
}

export async function GET(): Promise<NextResponse> {
  return handle(async () => {
    const games = await getContainer().useCases.listGames.execute();
    return ok({ games: games.map(toGameSummaryDto) });
  }, "Error fetching games:");
}
