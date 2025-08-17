import { NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";
import type { Player, Question } from "@/types";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";

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
      questions: (gameDoc.questions || []).map(
        (q: any): Question => ({
          id: q._id?.toString() || "",
          text: q.text,
          options: q.options,
          correctAnswer: q.correctAnswer,
        })
      ),
      creatorId: gameDoc.creatorId,
      status: gameDoc.status,
      currentQuestionIndex: gameDoc.currentQuestionIndex,
      currentQuestionStartTime: gameDoc.currentQuestionStartTime || 0,
      questionTimeLimit: gameDoc.questionTimeLimit || DEFAULT_TIME_LIMIT_MS,
      createdAt: gameDoc.createdAt,
      players: (gameDoc.players || []).map(
        (p: any): Player => ({
          id: p.id,
          name: p.name,
          gameId: gameId,
          answers: p.answers || {},
          score: p.score || 0,
          joinedAt: p.joinedAt,
        })
      ),
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
