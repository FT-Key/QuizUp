import { type NextRequest, NextResponse } from "next/server";
import connectToDB from "@/lib/mongoose";
import { Game } from "@/models/Game";
import type { JoinGameData, Player } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    await connectToDB();

    const data: JoinGameData = await request.json();

    if (!data.gameId || !data.playerName) {
      return NextResponse.json(
        { error: "Game ID and player name are required" },
        { status: 400 }
      );
    }

    const game = await Game.findOne({ gameCode: data.gameId });
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "waiting") {
      return NextResponse.json(
        { error: "Game is no longer accepting players" },
        { status: 400 }
      );
    }

    if (game.locked) {
      return NextResponse.json(
        { error: "Game entry is locked" },
        { status: 403 }
      );
    }

    const existingPlayer = (game.players as Player[]).find(
      (p) => p.name.toLowerCase() === data.playerName.toLowerCase()
    );
    if (existingPlayer) {
      return NextResponse.json(
        { error: "Player name is already taken in this game" },
        { status: 400 }
      );
    }

    const newPlayer: Player = {
      id: uuidv4(),
      name: data.playerName,
      gameId: game.gameCode,
      answers: {},
      score: 0,
      joinedAt: new Date(),
      avatar: data.avatar || { seed: data.playerName },
    };

    game.players.push(newPlayer);
    await game.save();

    const gameForFrontend = {
      id: game.gameCode,
      name: game.name,
      questions: game.questions,
      creatorId: game.creatorId,
      status: game.status,
      currentQuestionIndex: game.currentQuestionIndex,
      createdAt: game.createdAt,
      players: (game.players as Player[]).map((p) => ({
        id: p.id,
        name: p.name,
        gameId: p.gameId,
        answers: p.answers,
        score: p.score,
        joinedAt: p.joinedAt,
        avatar: p.avatar,
      })),
    };

    return NextResponse.json(
      { player: newPlayer, game: gameForFrontend },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error joining game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
