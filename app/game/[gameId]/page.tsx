"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { QuestionCard } from "@/components/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Clock } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import type { Game, Player, GameResults, Question } from "@/types";

export default function GamePage() {
  const params = useParams();
  const rawGameId = params.gameId;
  if (!rawGameId || Array.isArray(rawGameId)) throw new Error("Invalid gameId");
  const gameId = rawGameId;

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

  const prevQuestionIndexRef = useRef<number | null>(null);

  const { emit, on, off, connected } = useSocket();

  // ---- Fetch initial game data ----
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
        console.error("[GamePage] fetchGame error:", err);
        setError("Failed to load game");
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId]);

  // ---- Socket listeners ----
  useEffect(() => {
    if (!connected) return;

    const handleJoined = (data: { player: Player; game: Game }) => {
      localStorage.setItem("playerId", data.player.id);
      localStorage.setItem("playerName", data.player.name);
      setPlayer(data.player);
      setGame(data.game);

      const curQ = data.game.questions[data.game.currentQuestionIndex];
      if (curQ) setHasSubmitted(Boolean(data.player.answers?.[curQ.id]));
      setLoading(false);
    };

    const handleGameStarted = (data: { game: Game }) => {
      setIsQuestionFinished(false);
      setHasSubmitted(false);
      setPlayerAnswerResult(null);
      setGame(data.game);

      const pid = localStorage.getItem("playerId");
      if (pid) {
        const me = data.game.players.find((p) => p.id === pid);
        if (me) setPlayer(me);
      }
    };

    const handleGameUpdated = (payload: { game: Game }) => {
      const updatedGame = payload.game;
      setGame(updatedGame);

      const pid = localStorage.getItem("playerId");
      let me: Player | undefined;
      if (pid) {
        me = updatedGame.players.find((p) => p.id === pid);
        if (me) {
          setPlayer(me);
          const curQ = updatedGame.questions[updatedGame.currentQuestionIndex];
          if (curQ) setHasSubmitted(Boolean(me.answers?.[curQ.id]));
        }
      }

      const curQ = updatedGame.questions[updatedGame.currentQuestionIndex];
      if (curQ) {
        const allAnswered = updatedGame.players.every(
          (p) => p.answers?.[curQ.id] !== undefined
        );
        setIsQuestionFinished(allAnswered);
        if (allAnswered && me) {
          const playerAns = me.answers?.[curQ.id];
          if (playerAns !== undefined) {
            setPlayerAnswerResult({
              correct: playerAns === curQ.correctAnswer,
              score: me.score || 0,
            });
          }
        }
      }

      prevQuestionIndexRef.current = updatedGame.currentQuestionIndex;
    };

    const handleQuestionFinished = () => {
      setIsQuestionFinished(true);
      emit("request-game-state", { gameId });
    };

    const handleGameState = (payload: {
      game: Game;
      currentQuestion: Question | null;
      currentQuestionIndex: number;
    }) => {
      setGame(payload.game);

      const pid = localStorage.getItem("playerId");
      if (pid) {
        const me = payload.game.players.find((p) => p.id === pid);
        if (me) {
          setPlayer(me);
          const curQ = payload.game.questions[payload.currentQuestionIndex];
          if (curQ) {
            setHasSubmitted(Boolean(me.answers?.[curQ.id] !== undefined));
            if (me.answers?.[curQ.id] !== undefined) {
              setPlayerAnswerResult({
                correct: me.answers[curQ.id] === curQ.correctAnswer,
                score: me.score || 0,
              });
            }
          }
        }
      }
    };

    const handleJoinError = (payload: any) => {
      console.error("[GamePage] join-error:", payload);
      alert(payload?.message || "Failed to join the game");
    };

    // Suscribimos eventos
    on("joined", handleJoined);
    on("game-started", handleGameStarted);
    on("game-updated", handleGameUpdated);
    on("question-finished", handleQuestionFinished);
    on("game-state", handleGameState);
    on("join-error", handleJoinError);

    return () => {
      off("joined", handleJoined);
      off("game-started", handleGameStarted);
      off("game-updated", handleGameUpdated);
      off("question-finished", handleQuestionFinished);
      off("game-state", handleGameState);
      off("join-error", handleJoinError);
    };
  }, [connected, emit, on, off, gameId]);

  // ---- Join Form ----
  const JoinForm = () => {
    const [name, setName] = useState<string>(
      localStorage.getItem("playerName") || ""
    );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;
      emit("join-game", { gameId, playerName: trimmed });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded p-2"
          placeholder="Enter a display name..."
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded py-2"
        >
          Join Game
        </button>
      </form>
    );
  };

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

  // ---- Loading / Error UI ----
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
            <CardTitle className="text-center">Join the Quiz</CardTitle>
          </CardHeader>
          <CardContent>
            <JoinForm />
          </CardContent>
        </Card>
      </div>
    );

  // ---- Main Player UI ----
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

        {/* Active - question in progress */}
        {game.status === "active" &&
          !isQuestionFinished &&
          !hasSubmitted &&
          currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              onAnswerSubmit={handleAnswerSubmit}
            />
          )}

        {/* Active - player submitted */}
        {game.status === "active" && hasSubmitted && !isQuestionFinished && (
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <CardContent className="pt-6 text-center text-blue-800 dark:text-blue-200">
              Answer submitted! Waiting for other players...
            </CardContent>
          </Card>
        )}

        {/* Active - question finished */}
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

        {/* Finished */}
        {game.status === "finished" && results && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quiz Results</CardTitle>
            </CardHeader>
            <CardContent>{/* Leaderboard / summary */}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
