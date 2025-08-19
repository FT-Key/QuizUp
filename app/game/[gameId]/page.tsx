"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { QuestionCard } from "@/components/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Clock } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import type { Game, Player, GameResults, Question } from "@/types";

/**
 * GamePage (player)
 */
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

  // keep prevQuestionIndex to detect transitions if needed
  const prevQuestionIndexRef = useRef<number | null>(null);

  // ---- Fetch initial game data once
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

    if (gameId) fetchGame();
  }, [gameId]);

  // ---- Socket integration (single call)
  const { socket, emit } = useSocket({
    gameId,
    events: [
      {
        // server replies to the joining socket with this event
        event: "joined",
        callback: (data: { player: Player; game: Game }) => {
          console.log("[GamePage] joined received:", data);
          if (data.player) {
            localStorage.setItem("playerId", data.player.id);
            localStorage.setItem("playerName", data.player.name);
            setPlayer(data.player);
          }
          if (data.game) {
            setGame(data.game);
            // determine submission state for the current question
            const curQ = data.game.questions[data.game.currentQuestionIndex];
            if (data.player && curQ) {
              setHasSubmitted(
                Boolean(
                  data.player.answers &&
                    data.player.answers[curQ.id] !== undefined
                )
              );
            }
          }
          setLoading(false);
        },
      },
      {
        event: "game-started",
        callback: (data: {
          game: Game;
          players: Player[];
          currentQuestion: Question;
        }) => {
          console.log("[GamePage] game-started:", data);
          setIsQuestionFinished(false);
          setHasSubmitted(false);
          setPlayerAnswerResult(null);
          setGame(data.game);
          // if we already have a playerId, make sure to update the local player
          const pid = localStorage.getItem("playerId");
          if (pid) {
            const found = data.game.players.find((p) => p.id === pid);
            if (found) setPlayer(found);
          }
        },
      },
      {
        event: "game-updated",
        callback: (payload: { game: Game }) => {
          console.log("[GamePage] game-updated:", payload.game);
          const updatedGame = payload.game;
          // update game
          setGame(updatedGame);

          // update local player object (if we have a player id)
          const pid = localStorage.getItem("playerId");
          if (pid) {
            const found = updatedGame.players.find((p) => p.id === pid);
            if (found) {
              setPlayer(found);
              // check submission status for current question
              const curQ =
                updatedGame.questions[updatedGame.currentQuestionIndex];
              if (curQ) {
                setHasSubmitted(
                  Boolean(found.answers && found.answers[curQ.id] !== undefined)
                );
              }
            }
          }

          // detect if question finished: if all players answered the current question
          const curQ = updatedGame.questions[updatedGame.currentQuestionIndex];
          if (curQ) {
            const allAnswered = updatedGame.players.every(
              (p) => p.answers?.[curQ.id] !== undefined
            );
            setIsQuestionFinished(allAnswered);
            // if finished and we have player, compute player's result (if available)
            if (allAnswered) {
              const pid2 = localStorage.getItem("playerId");
              if (pid2) {
                const me = updatedGame.players.find((p) => p.id === pid2);
                if (me) {
                  const playerAns = me.answers?.[curQ.id];
                  if (playerAns !== undefined) {
                    setPlayerAnswerResult({
                      correct: playerAns === curQ.correctAnswer,
                      score: me.score || 0,
                    });
                  }
                }
              }
            }
          }

          // update prevQuestionIndex
          prevQuestionIndexRef.current = updatedGame.currentQuestionIndex;
        },
      },
      {
        event: "question-finished",
        callback: (data: any) => {
          console.log("[GamePage] question-finished event:", data);
          // mark question as finished locally, then request full game-state to be safe
          setIsQuestionFinished(true);
          // request the authoritative game-state from the server for latest scores/players
          emit("request-game-state", { gameId });
        },
      },
      {
        // handler for game-state responses (from request-game-state)
        event: "game-state",
        callback: (payload: {
          game: Game;
          currentQuestion: Question | null;
          currentQuestionIndex: number;
          timeLeft: number;
        }) => {
          console.log("[GamePage] game-state received:", payload);
          setGame(payload.game);
          const pid = localStorage.getItem("playerId");
          if (pid) {
            const found = payload.game.players.find((p) => p.id === pid);
            if (found) {
              setPlayer(found);
              const curQ = payload.game.questions[payload.currentQuestionIndex];
              if (curQ) {
                setHasSubmitted(
                  Boolean(found.answers && found.answers[curQ.id] !== undefined)
                );
                // if question just finished, compute result for display
                if (found.answers?.[curQ.id] !== undefined) {
                  setPlayerAnswerResult({
                    correct: found.answers[curQ.id] === curQ.correctAnswer,
                    score: found.score || 0,
                  });
                }
              }
            }
          }
        },
      },
      {
        // generic error when join fails
        event: "join-error",
        callback: (payload: any) => {
          console.error("[GamePage] join-error:", payload);
          alert(payload?.message || "Failed to join the game");
        },
      },
    ],
  });

  // ---- Join form component (renders when !player)
  function JoinForm() {
    const [name, setName] = useState<string>(() => {
      return localStorage.getItem("playerName") || "";
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || !emit) return;
      console.log("[JoinForm] emitting join-game:", {
        gameId,
        playerName: trimmed,
      });
      emit("join-game", { gameId, playerName: trimmed });
      // server will reply with 'joined' which updates state and localStorage
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
  }

  // ---- Submit answer
  const handleAnswerSubmit = (answerIndex: number) => {
    if (!player || !game) return;
    const currentQuestion = game.questions[game.currentQuestionIndex];
    if (!currentQuestion) return;

    console.log("[GamePage] submit-answer emit:", {
      gameId,
      playerId: player.id,
      questionId: currentQuestion.id,
      answer: answerIndex,
    });

    emit("submit-answer", {
      gameId,
      playerId: player.id,
      questionId: currentQuestion.id,
      answer: answerIndex,
    });

    // optimistic update local player answers so UI responds instantly
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

  // If player is not set yet, show join form
  if (!player) {
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
  }

  // Main player UI
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
