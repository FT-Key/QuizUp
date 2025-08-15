"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerList } from "@/components/PlayerList";
import { Results } from "@/components/Results";
import { initSocket } from "@/lib/socket";
import type { Player, GameState } from "@/types";
import { Users, Play, Square, RotateCcw } from "lucide-react";

export default function AdminPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) {
          throw new Error("Game not found");
        }
        const data = await response.json();
        setGameState(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load game");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameData();

    // Setup WebSocket connection
    const socket = initSocket();

    socket.emit("join-admin", gameId);

    socket.on("player-joined", (data: { player: Player }) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              players: [...prev.players, data.player],
            }
          : null
      );
    });

    socket.on("game-updated", (data: GameState) => {
      setGameState(data);
    });

    socket.on(
      "answer-submitted",
      (data: { playerId: string; questionId: string; answer: number }) => {
        // Update UI to show player has answered
        console.log("Player answered:", data);
      }
    );

    return () => {
      socket.off("player-joined");
      socket.off("game-updated");
      socket.off("answer-submitted");
      socket.disconnect();
    };
  }, [gameId]);

  const startGame = async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/start`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to start game");
      }
    } catch (err) {
      console.error("Error starting game:", err);
      alert("Failed to start game");
    }
  };

  const finishGame = async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/finish`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to finish game");
      }
    } catch (err) {
      console.error("Error finishing game:", err);
      alert("Failed to finish game");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              {error || "Game not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { game, players } = gameState;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {game.name}
          </h1>
          <div className="flex items-center justify-center gap-4">
            <Badge
              variant={
                game.status === "waiting"
                  ? "secondary"
                  : game.status === "active"
                  ? "default"
                  : "outline"
              }
            >
              {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Users className="h-4 w-4" />
              {players.length} player{players.length !== 1 ? "s" : ""}
            </div>
          </div>
          <p className="text-lg font-mono bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg inline-block">
            Game ID:{" "}
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {game.id}
            </span>
          </p>
        </div>

        {/* Game Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Game Controls</CardTitle>
            <CardDescription>
              {game.status === "waiting" &&
                "Start the game when all players have joined"}
              {game.status === "active" &&
                `Question ${game.currentQuestionIndex + 1} of ${
                  game.questions.length
                }`}
              {game.status === "finished" &&
                "Game completed - view results below"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {game.status === "waiting" && (
                <Button
                  onClick={startGame}
                  disabled={players.length === 0}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Game
                </Button>
              )}
              {game.status === "active" && (
                <Button
                  onClick={finishGame}
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Square className="h-4 w-4" />
                  End Game
                </Button>
              )}
              {game.status === "finished" && (
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Create New Game
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Players List */}
          <Card>
            <CardHeader>
              <CardTitle>Players ({players.length})</CardTitle>
              <CardDescription>
                {game.status === "waiting" && "Players joining the game"}
                {game.status === "active" && "Current game participants"}
                {game.status === "finished" && "Final participants"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlayerList players={players} gameStatus={game.status} />
            </CardContent>
          </Card>

          {/* Current Question or Results */}
          <Card>
            <CardHeader>
              <CardTitle>
                {game.status === "waiting" && "Game Preview"}
                {game.status === "active" &&
                  `Current Question (${game.currentQuestionIndex + 1}/${
                    game.questions.length
                  })`}
                {game.status === "finished" && "Final Results"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {game.status === "waiting" && (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Quiz ready with {game.questions.length} question
                    {game.questions.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Share the Game ID with players so they can join
                  </p>
                </div>
              )}
              {game.status === "active" && gameState.currentQuestion && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    {gameState.currentQuestion.text}
                  </h3>
                  <div className="grid gap-2">
                    {gameState.currentQuestion.options.map((option, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          index === gameState.currentQuestion!.correctAnswer
                            ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                            : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                        }`}
                      >
                        <span className="font-medium">
                          {String.fromCharCode(65 + index)}.
                        </span>{" "}
                        {option}
                        {index === gameState.currentQuestion!.correctAnswer && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Correct
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {game.status === "finished" && <Results gameId={gameId} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
