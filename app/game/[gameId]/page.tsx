"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QuestionCard } from "@/components/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Clock } from "lucide-react";
import { initSocket, disconnectSocket } from "@/lib/socket";
import type { Game, Player, GameResults, Question, GameState } from "@/types";

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState<GameResults | null>(null);

  // Fetch game data
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        if (!res.ok) throw new Error("Game not found");
        const data = await res.json();
        setGame(data.game);

        const playerId = localStorage.getItem("playerId");
        const playerName = localStorage.getItem("playerName");
        if (playerId && playerName) {
          const foundPlayer = data.game.players.find(
            (p: Player) => p.id === playerId
          );
          if (foundPlayer) {
            setPlayer(foundPlayer);
            const currentQuestion =
              data.game.questions[data.game.currentQuestionIndex];
            setHasSubmitted(
              foundPlayer.answers?.[currentQuestion.id] !== undefined
            );
          }
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load game");
      } finally {
        setLoading(false);
      }
    };

    if (gameId) fetchGame();
  }, [gameId]);

  // Socket events
  useEffect(() => {
    if (!game || !player) return;
    const socket = initSocket();

    socket.emit("join-game", { gameId, playerId: player.id, isAdmin: false });

    // --- eventos que modifican el estado ---
    socket.on("game-started", () => {
      setGame((prev) => (prev ? { ...prev, status: "active" } : null));
    });

    socket.on("game-updated", (state: GameState) => {
      // state.game → trae el juego completo actualizado
      setGame(state.game);
    });

    socket.on(
      "question-changed",
      (data: { question: Question; questionIndex: number }) => {
        setGame((prev) =>
          prev ? { ...prev, currentQuestionIndex: data.questionIndex } : null
        );
        setHasSubmitted(player.answers?.[data.question.id] !== undefined);
      }
    );

    socket.on("game-finished", (data: { results: GameResults }) => {
      setGame((prev) => (prev ? { ...prev, status: "finished" } : null));
      setResults(data.results);
    });

    return () => {
      socket.off("game-started");
      socket.off("game-updated");
      socket.off("question-changed");
      socket.off("game-finished");
    };
  }, [game, player, gameId]);

  useEffect(() => disconnectSocket, []);

  const handleAnswerSubmit = (answerIndex: number) => {
    if (!player || !game) return;
    const socket = initSocket();
    const currentQuestion = game.questions[game.currentQuestionIndex];

    socket.emit("submit-answer", {
      gameId,
      playerId: player.id,
      questionId: currentQuestion.id,
      answer: answerIndex,
    });

    setHasSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-300">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-300">
              {error || "Game not found"}
            </p>
            <div className="mt-4 text-center">
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
              >
                Back to Home
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Join Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
              You need to join this game first.
            </p>
            <div className="text-center">
              <a
                href="/join"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
              >
                Join Game
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = game.questions[game.currentQuestionIndex];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Game Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {game.name}
          </h1>
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{game.players.length} players</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span className="capitalize">{game.status}</span>
            </div>
          </div>
        </div>

        {/* Game Status */}
        {game.status === "waiting" && (
          <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <CardContent className="pt-6 text-center text-yellow-800 dark:text-yellow-200">
              Waiting for the game to start...
            </CardContent>
          </Card>
        )}

        {/* Question Card */}
        {game.status === "active" && !hasSubmitted && (
          <QuestionCard
            question={currentQuestion}
            onAnswerSubmit={handleAnswerSubmit}
          />
        )}

        {/* Waiting for Results */}
        {game.status === "active" && hasSubmitted && (
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <CardContent className="pt-6 text-center text-blue-800 dark:text-blue-200">
              Answer submitted! Waiting for other players...
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {game.status === "finished" && results && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quiz Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                    Total Players
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {results.totalPlayers}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                    Total Questions
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {results.totalQuestions}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">
                    Leaderboard
                  </p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    Top: {results.leaderboard[0]?.name || "-"} (
                    {results.leaderboard[0]?.score || 0})
                  </p>
                </div>
              </div>

              {/* Full leaderboard */}
              <div className="space-y-2">
                {results.leaderboard.map((p) => (
                  <Card key={p.playerId} className="p-2">
                    <div className="flex justify-between">
                      <span>{p.name}</span>
                      <span>
                        {p.correctAnswers} / {results.totalQuestions} (
                        {p.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Player Info */}
        <Card className="bg-gray-50 dark:bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-lg">Your Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                Player Name:
              </span>
              <span className="font-medium">{player.name}</span>
            </div>
            {hasSubmitted && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-600 dark:text-gray-300">
                  Answer Submitted:
                </span>
                <span className="text-green-600 dark:text-green-400">Yes</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
