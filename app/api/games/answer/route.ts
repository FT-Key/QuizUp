import { type NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/gameStore";

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerId, questionId, answer } = await request.json();

    // Validar campos obligatorios
    if (!gameId || !playerId || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: "gameId, playerId, questionId and answer are required" },
        { status: 400 }
      );
    }

    // Validar rango de respuesta
    if (answer < 0 || answer > 3) {
      return NextResponse.json(
        { error: "Invalid answer index" },
        { status: 400 }
      );
    }

    // Enviar respuesta
    const success = gameStore.submitAnswer(playerId, questionId, answer);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to submit answer" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting answer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
