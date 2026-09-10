"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { QuestionCard } from "@/components/QuestionCard";
import { Results } from "@/components/Results";
import { Loader2, Users, Clock } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import type { Game, Player, GameResults, Question } from "@/types";

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

  const prevQuestionIndexRef = useRef<number | null>(null);

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
            emit("join-game", { gameId, playerId });

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

  const emitRef = useRef<((event: string, data?: any) => void) | null>(null);
  const { socket, emit } = useSocket({
    gameId,
    events: useMemo(
      () => [
        {
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
            setGame(updatedGame);

            const pid = localStorage.getItem("playerId");
            if (pid) {
              const found = updatedGame.players.find((p) => p.id === pid);
              if (found) {
                setPlayer(found);
                const curQ =
                  updatedGame.questions[updatedGame.currentQuestionIndex];
                if (curQ) {
                  const hasAnswer = found.answers && found.answers[curQ.id] !== undefined;
                  console.log(`[GamePage] game-updated: player ${found.name} answer for q ${curQ.id}: ${found.answers?.[curQ.id]}, hasAnswer: ${hasAnswer}`);
                  setHasSubmitted(Boolean(hasAnswer));
                }
              }
            }

            const curQ = updatedGame.questions[updatedGame.currentQuestionIndex];
            if (curQ) {
              const allAnswered = updatedGame.players.every(
                (p) => p.answers?.[curQ.id] !== undefined
              );
              console.log(`[GamePage] game-updated: allAnswered=${allAnswered} for q ${curQ.id}`);
              setIsQuestionFinished(allAnswered);
              if (allAnswered) {
                const pid2 = localStorage.getItem("playerId");
                if (pid2) {
                  const me = updatedGame.players.find((p) => p.id === pid2);
                  if (me) {
                    const playerAns = me.answers?.[curQ.id];
                    console.log(`[GamePage] game-updated: my answer=${playerAns}, correctAnswer=${curQ.correctAnswer}`);
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

            prevQuestionIndexRef.current = updatedGame.currentQuestionIndex;
          },
        },
        {
          event: "question-finished",
          callback: (data: any) => {
            console.log("[GamePage] question-finished event:", data);
            setIsQuestionFinished(true);
            emitRef.current?.("request-game-state", { gameId });
          },
        },
        {
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
          event: "join-error",
          callback: (payload: any) => {
            console.error("[GamePage] join-error:", payload);
            alert(payload?.message || "Failed to join the game");
          },
        },
        {
          event: "game-finished",
          callback: (data: { game: Game; results: GameResults }) => {
            console.log("[GamePage] game-finished:", data);
            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
            }
            if (data.results) {
              setResults(data.results);
            }
          },
        },
        {
          event: "question-changed",
          callback: (data: { question: Question; questionIndex: number; timeLeft: number }) => {
            console.log("[GamePage] question-changed:", data);
            setIsQuestionFinished(false);
            setHasSubmitted(false);
            setPlayerAnswerResult(null);
            setGame((prev) => {
              if (!prev) return prev;
              return { ...prev, currentQuestionIndex: data.questionIndex };
            });
          },
        },
      ],
      [gameId]
    ),
  });

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  function JoinForm() {
    const [name, setName] = useState<string>(() => {
      return localStorage.getItem("playerName") || "";
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || !emit) return;
      emit("join-game", { gameId, playerName: trimmed });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Your Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 text-lg font-medium border-3 border-white/30 rounded-2xl bg-white/20 text-white placeholder-white/60 focus:border-white focus:ring-4 focus:ring-white/30 transition-all outline-none"
          style={{ borderWidth: "3px" }}
          placeholder="Enter a display name..."
        />
        <button
          type="submit"
          className="w-full py-4 text-lg font-black text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
            boxShadow: "0 6px 20px rgba(19, 104, 206, 0.4)",
          }}
        >
          JOIN GAME
        </button>
      </form>
    );
  }

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

    // Show result immediately (computed locally, no need to wait for server)
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    setPlayerAnswerResult({
      correct: isCorrect,
      score: player.score || 0,
    });
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-white" />
          <p className="text-xl font-bold text-white">Loading game...</p>
        </div>
      </div>
    );

  if (error || !game)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-black text-[#E21B3C] mb-4">Error</h2>
          <p className="text-gray-600">{error || "Game not found"}</p>
        </div>
      </div>
    );

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div 
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8"
          style={{ animation: "bounce-in 0.6s ease-out" }}
        >
          <h2 className="text-2xl font-black text-center text-gray-800 mb-6">
            Join the Quiz
          </h2>
          <JoinForm />
        </div>
      </div>
    );
  }

  const currentQuestion = game.questions[game.currentQuestionIndex];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Game Header */}
        <div 
          className="text-center space-y-3 py-6 px-8 bg-white/15 backdrop-blur-sm rounded-3xl"
          style={{ animation: "slide-up 0.5s ease-out" }}
        >
          <h1 className="text-3xl md:text-4xl font-black text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
            {game.name}
          </h1>
          <div className="flex items-center justify-center space-x-6 text-base font-bold">
            <div className="flex items-center space-x-2 text-white/90">
              <Users className="h-5 w-5" />
              <span>{game.players.length} players</span>
            </div>
            <div className="flex items-center space-x-2 text-white/90">
              <Clock className="h-5 w-5" />
              <span className="capitalize px-3 py-1 bg-white/20 rounded-full">{game.status}</span>
            </div>
          </div>
        </div>

        {/* Waiting */}
        {game.status === "waiting" && (
          <div 
            className="bg-white rounded-3xl shadow-xl p-8 text-center"
            style={{ animation: "bounce-in 0.6s ease-out" }}
          >
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-xl font-bold text-gray-800">
              Waiting for the game to start...
            </p>
            <p className="text-gray-500 mt-2">The host will start the quiz soon</p>
          </div>
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

        {/* ACTIVE - question finished, player answered correctly */}
        {game.status === "active" &&
          hasSubmitted &&
          playerAnswerResult && playerAnswerResult.correct && (
            <div 
              className="bg-white rounded-3xl shadow-xl p-8 text-center"
              style={{ animation: "bounce-in 0.5s ease-out" }}
            >
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-3xl font-black text-[#26890C]">
                Correct!
              </p>
              <p className="text-xl font-bold text-[#26890C]/80 mt-2">
                +{playerAnswerResult.score} points
              </p>
            </div>
          )}

        {/* ACTIVE - question finished, player answered incorrectly */}
        {game.status === "active" &&
          hasSubmitted &&
          playerAnswerResult && !playerAnswerResult.correct && (
            <div 
              className="bg-white rounded-3xl shadow-xl p-8 text-center"
              style={{ animation: "bounce-in 0.5s ease-out" }}
            >
              <div className="text-6xl mb-4">✗</div>
              <p className="text-3xl font-black text-[#E21B3C]">
                Incorrect!
              </p>
              <p className="text-gray-500 mt-2">Better luck next time!</p>
            </div>
          )}

        {/* ACTIVE - question finished, player did NOT answer */}
        {game.status === "active" &&
          isQuestionFinished &&
          !playerAnswerResult && (
            <div 
              className="bg-white rounded-3xl shadow-xl p-8 text-center"
              style={{ animation: "bounce-in 0.5s ease-out" }}
            >
              <div className="text-5xl mb-4">⏰</div>
              <p className="text-xl font-bold text-[#FFC900]">
                Time&apos;s up!
              </p>
              <p className="text-gray-500 mt-2">You didn&apos;t submit an answer.</p>
            </div>
          )}

        {/* FINISHED */}
        {game.status === "finished" && (
          <Results gameId={gameId} results={results} />
        )}
      </div>
    </div>
  );
}
