import { type NextRequest, NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";
import type { CreateGameData } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    await connectToDB();

    const data: CreateGameData = await request.json();

    // Validación básica
    if (!data.name || !data.questions || data.questions.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validar cada pregunta
    for (const q of data.questions) {
      if (!q.text || !q.options || q.options.length !== 4) {
        return NextResponse.json(
          { error: "Each question must have text and exactly 4 options" },
          { status: 400 }
        );
      }
      if (q.options.some((o) => !o.trim())) {
        return NextResponse.json(
          { error: "All answer options must be provided" },
          { status: 400 }
        );
      }
      if (q.correctAnswer < 0 || q.correctAnswer > 3) {
        return NextResponse.json(
          { error: "Invalid correct answer index" },
          { status: 400 }
        );
      }
    }

    // Generar creatorId temporal (en app real vendría de auth)
    const creatorId = uuidv4();

    // Crear el juego en MongoDB
    const gameDoc = await Game.create({
      name: data.name,
      questions: data.questions,
      creatorId,
    });

    // Mapear _id a id para frontend
    const game = {
      id: gameDoc._id.toString(),
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

    // Mapear _id a id para todos los juegos
    const games = gamesDocs.map((g) => ({
      id: g._id.toString(),
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
