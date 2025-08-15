import { NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";

interface Params {
  params: { gameId: string };
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { gameId } = params;

    await connectToDB();
    const game = await Game.findById(gameId);
    if (!game)
      return NextResponse.json({ error: "Game not found" }, { status: 404 });

    if (game.status !== "active") {
      return NextResponse.json(
        { error: "Game cannot be finished" },
        { status: 400 }
      );
    }

    game.status = "finished";
    await game.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error finishing game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
