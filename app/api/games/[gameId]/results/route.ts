import { NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";
import type { GameResults, Player, Question } from "@/types";

interface Params {
  params: { gameId: string };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { gameId } = params;

    await connectToDB();
    const gameDoc = await Game.findById(gameId);
    if (!gameDoc || gameDoc.status !== "finished") {
      return NextResponse.json(
        { error: "Game not found or no results available" },
        { status: 404 }
      );
    }

    // Tipar arrays explícitamente
    const players: Player[] = gameDoc.players as Player[];
    const questions: Question[] = gameDoc.questions as Question[];

    const results: GameResults = {
      gameId: gameDoc._id.toString(),
      createdAt: gameDoc.createdAt,
      totalPlayers: players.length,
      totalQuestions: questions.length,
      leaderboard: players.map((p: Player) => ({
        playerId: p.id,
        name: p.name,
        score: p.score,
        correctAnswers: Object.keys(p.answers).length,
        totalQuestions: questions.length,
        percentage: (Object.keys(p.answers).length / questions.length) * 100,
      })),
      questionResults: questions.map((q: Question) => ({
        questionId: q.id,
        questionText: q.text,
        correctAnswer: q.correctAnswer,
        playerAnswers: players.map((p: Player) => ({
          playerId: p.id,
          name: p.name,
          answer: p.answers[q.id] ?? -1,
          isCorrect: p.answers[q.id] === q.correctAnswer,
        })),
      })),
      averageScore:
        players.reduce((sum: number, p: Player) => sum + p.score, 0) /
        (players.length || 1),
    };

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
