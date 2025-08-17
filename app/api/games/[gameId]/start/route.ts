// app/api/games/[gameId]/start/route.ts
import { NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";
import type { Game as GameType } from "@/types";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";

interface Params {
  params: { gameId: string };
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { gameId } = params;

    await connectToDB();

    const gameDoc = await Game.findById(gameId);
    if (!gameDoc) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (gameDoc.status !== "waiting") {
      return NextResponse.json(
        { error: "Game cannot be started" },
        { status: 400 }
      );
    }

    if (!gameDoc.players || gameDoc.players.length === 0) {
      return NextResponse.json(
        { error: "Cannot start game with no players" },
        { status: 400 }
      );
    }

    // Iniciar juego
    gameDoc.status = "active";
    gameDoc.currentQuestionIndex = 0;
    gameDoc.currentQuestionStartTime = Date.now();
    gameDoc.questionTimeLimit =
      gameDoc.questionTimeLimit || DEFAULT_TIME_LIMIT_MS;

    await gameDoc.save();

    // Retornar estado completo del juego tipado
    const game: GameType = {
      id: gameDoc._id.toString(),
      name: gameDoc.name,
      questions: (gameDoc.questions || []).map((q: any) => ({
        id: q._id?.toString() || "",
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
      })),
      creatorId: gameDoc.creatorId,
      status: gameDoc.status,
      currentQuestionIndex: gameDoc.currentQuestionIndex,
      currentQuestionStartTime: gameDoc.currentQuestionStartTime,
      questionTimeLimit: gameDoc.questionTimeLimit,
      createdAt: gameDoc.createdAt,
      players: (gameDoc.players || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        gameId,
        answers: p.answers || {},
        score: p.score || 0,
        joinedAt: p.joinedAt,
      })),
    };

    return NextResponse.json({ game });
  } catch (error) {
    console.error("Error starting game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
