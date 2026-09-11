import { type NextRequest, NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";
import { v4 as uuidv4 } from "uuid";
import { getUniqueGameCode } from "@/lib/gameCode";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import { sanitizeQuizData, QuizFileError } from "@/lib/quizFile";

export async function POST(request: NextRequest) {
  try {
    await connectToDB();

    const raw = await request.json().catch(() => null);
    if (!raw) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    let data;
    try {
      data = sanitizeQuizData(raw);
    } catch (error) {
      const message =
        error instanceof QuizFileError ? error.message : "Invalid game data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!data.name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const creatorId = uuidv4();
    const gameCode = await getUniqueGameCode();
    const questionTimeLimit = data.questionTimeLimit || DEFAULT_TIME_LIMIT_MS;

    const gameDoc = await Game.create({
      name: data.name,
      gameCode,
      questions: data.questions,
      creatorId,
      questionTimeLimit,
    });

    const game = {
      id: gameDoc.gameCode,
      name: gameDoc.name,
      questions: gameDoc.questions,
      creatorId: gameDoc.creatorId,
      status: gameDoc.status,
      currentQuestionIndex: gameDoc.currentQuestionIndex,
      createdAt: gameDoc.createdAt,
    };

    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectToDB();
    const gamesDocs = await Game.find().sort({ createdAt: -1 });

    const games = gamesDocs.map((g) => ({
      id: g.gameCode,
      name: g.name,
      questions: g.questions,
      creatorId: g.creatorId,
      status: g.status,
      currentQuestionIndex: g.currentQuestionIndex,
      createdAt: g.createdAt,
    }));

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
