
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

    const gameDoc = await Game.findOne({ gameCode: gameId });
    if (!gameDoc || gameDoc.status !== "finished") {
      return NextResponse.json(
        { error: "Game not found or no results available" },
        { status: 404 }
      );
    }

    const players: Player[] = (gameDoc.players || []).map((p: any) => {
      let answers: Record<string, number> = {};
      if (p.answers instanceof Map) {
        for (const [k, v] of p.answers) answers[k] = v;
      } else if (p.answers && typeof p.answers === "object") {
        answers = { ...p.answers };
      }
      return {
        id: p.id,
        name: p.name,
        gameId: gameDoc.gameCode,
        answers,
        score: p.score || 0,
        joinedAt: p.joinedAt,
        avatar: p.avatar || undefined,
      };
    });

    const questions: Question[] = (gameDoc.questions || []).map((q: any) => ({
      id: q._id?.toString() || q.id || "",
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      image: q.image ?? null,
    }));

    const results: GameResults = {
      gameId: gameDoc.gameCode,
      createdAt: gameDoc.createdAt,
      totalPlayers: players.length,
      totalQuestions: questions.length,
      leaderboard: players.map((p) => {
        const correctAnswers = questions.filter(
          (q) => p.answers[q.id] === q.correctAnswer
        ).length;

        return {
          playerId: p.id,
          name: p.name,
          score: p.score,
          correctAnswers,
          totalQuestions: questions.length,
          percentage:
            questions.length > 0
              ? Math.round((correctAnswers / questions.length) * 100)
              : 0,
          avatar: p.avatar || undefined,
        };
      }),
      questionResults: questions.map((q) => ({
        questionId: q.id,
        questionText: q.text,
        correctAnswer: q.correctAnswer,
        playerAnswers: players.map((p) => ({
          playerId: p.id,
          name: p.name,
          answer: p.answers[q.id] ?? -1,
          isCorrect: p.answers[q.id] === q.correctAnswer,
        })),
      })),
      averageScore:
        players.reduce((sum, p) => sum + p.score, 0) / (players.length || 1),
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
