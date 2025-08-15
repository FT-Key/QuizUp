import { NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";
import type { Player } from "@/types";

interface Params {
  params: { gameId: string };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { gameId } = params;

    await connectToDB();

    const gameDoc = await Game.findById(gameId);
    if (!gameDoc) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Mapear _id a id y players a Player[]
    const game = {
      id: gameDoc._id.toString(),
      name: gameDoc.name,
      questions: gameDoc.questions,
      creatorId: gameDoc.creatorId,
      status: gameDoc.status,
      currentQuestionIndex: gameDoc.currentQuestionIndex,
      createdAt: gameDoc.createdAt,
      players: (gameDoc.players || []) as Player[], // importante: evita undefined
    };

    return NextResponse.json({ game });
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
