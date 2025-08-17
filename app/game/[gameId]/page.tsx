"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QuestionCard } from "@/components/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Clock } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
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
  const [isQuestionFinished, setIsQuestionFinished] = useState(false);
  const [playerAnswerResult, setPlayerAnswerResult] = useState<{
    correct: boolean;
    score: number;
  } | null>(null);

  // ---- Fetch game data
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
            if (!foundPlayer.answers) foundPlayer.answers = {};
            setPlayer(foundPlayer);

            const currentQuestion =
              data.game.questions[data.game.currentQuestionIndex];
            if (currentQuestion) {
              setHasSubmitted(
                foundPlayer.answers?.[currentQuestion.id] !== undefined
              );
            }
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

  // ---- Socket integration
  const { emit } = useSocket({
    gameId,
    playerId: player?.id,
    events: [
      {
        event: "game-started",
        callback: (data: any) => {
          console.log("🚀 game-started event:", data);
          setIsQuestionFinished(false);
          setHasSubmitted(false);
          setPlayerAnswerResult(null);
          setGame((prev) => (prev ? { ...prev, status: "active" } : null));
        },
      },
      {
        event: "game-updated",
        callback: (state: GameState) => {
          console.log("🔄 game-updated event:", state);
          setGame(state.game);

          const currentQuestion =
            state.game.questions[state.game.currentQuestionIndex];
          if (currentQuestion) {
            const allAnswered = state.game.players.every(
              (p) => p.answers && p.answers[currentQuestion.id] !== undefined
            );
            console.log(
              "📊 allAnswered check for currentQuestion:",
              allAnswered,
              "currentQuestion.id:",
              currentQuestion.id
            );
            if (allAnswered) setIsQuestionFinished(true);
          }
        },
      },
      {
        event: "question-finished",
        callback: (data: {
          correctAnswer: number;
          scores: Record<string, number>;
        }) => {
          console.log("⏹ question-finished event:", data);
          setIsQuestionFinished(true);

          if (!game || !player) return;

          const currentQuestion = game.questions[game.currentQuestionIndex];
          const playerAnswer = player.answers?.[currentQuestion.id];

          if (playerAnswer === undefined) {
            console.log(
              "⚠️ Player has not answered yet, skipping correct check"
            );
            return; // evita marcar incorrect automáticamente
          }

          const correct = playerAnswer === currentQuestion.correctAnswer;
          const score = data.scores?.[player.id] || 0;
          setPlayerAnswerResult({ correct, score });
        },
      },
    ],
  });

  // ---- Submit answer
  const handleAnswerSubmit = (answerIndex: number) => {
    if (!player || !game) return;
    const currentQuestion = game.questions[game.currentQuestionIndex];
    if (!currentQuestion) return;

    emit("submit-answer", {
      gameId,
      playerId: player.id,
      questionId: currentQuestion.id,
      answer: answerIndex,
    });

    setPlayer((prev) =>
      prev
        ? {
            ...prev,
            answers: { ...prev.answers, [currentQuestion.id]: answerIndex },
          }
        : prev
    );
    setHasSubmitted(true);
  };

  // ---- Loading / Error handling
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-300">Loading game...</p>
        </div>
      </div>
    );

  if (error || !game)
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
          </CardContent>
        </Card>
      </div>
    );

  if (!player)
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
          </CardContent>
        </Card>
      </div>
    );

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

        {/* Waiting */}
        {game.status === "waiting" && (
          <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <CardContent className="pt-6 text-center text-yellow-800 dark:text-yellow-200">
              Waiting for the game to start...
            </CardContent>
          </Card>
        )}

        {/* ACTIVE - question in progress */}
        {game.status === "active" &&
          !isQuestionFinished &&
          !hasSubmitted &&
          currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              onAnswerSubmit={handleAnswerSubmit}
            />
          )}

        {/* ACTIVE - player submitted */}
        {game.status === "active" && hasSubmitted && !isQuestionFinished && (
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <CardContent className="pt-6 text-center text-blue-800 dark:text-blue-200">
              Answer submitted! Waiting for other players...
            </CardContent>
          </Card>
        )}

        {/* ACTIVE - question finished */}
        {game.status === "active" &&
          isQuestionFinished &&
          playerAnswerResult && (
            <Card className="bg-gray-50 border-gray-200 dark:bg-gray-800/20 dark:border-gray-700">
              <CardContent className="pt-6 text-center text-gray-800 dark:text-gray-200">
                {playerAnswerResult.correct ? (
                  <p className="text-green-600 dark:text-green-400">
                    Correct! +{playerAnswerResult.score} points
                  </p>
                ) : (
                  <p className="text-red-600 dark:text-red-400">Incorrect!</p>
                )}
              </CardContent>
            </Card>
          )}

        {/* FINISHED */}
        {game.status === "finished" && results && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quiz Results</CardTitle>
            </CardHeader>
            <CardContent>{/* Leaderboard / summary here */}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
