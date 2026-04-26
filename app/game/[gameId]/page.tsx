"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { QuestionCard } from "@/components/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Clock } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useQuestionTimer } from "@/hooks/useQuestionTimer";
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
  const [playerAnswerResult, setPlayerAnswerResult] = useState<{ correct: boolean; score: number } | null>(null);

  const prevQuestionIndexRef = useRef<number | null>(null);
  const { emit, on, off, connected } = useSocket();

  const currentQuestion = game?.questions[game.currentQuestionIndex];
  const { timeLeft, isFinished: timerFinished } = useQuestionTimer(
    game?.currentQuestionStartTime ?? 0,
    game?.questionTimeLimit ?? 30000,
    currentQuestion?.id
  );

  // Cuando el timer llega a 0, marcar pregunta como terminada
  useEffect(() => {
    if (timerFinished && game?.status === "active" && !isQuestionFinished) {
      console.log("[GamePage] timer finished locally, marking question as finished");
      setHasSubmitted(true);
      setIsQuestionFinished(true);
    }
  }, [timerFinished, game?.status, isQuestionFinished]);

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
          const foundPlayer = data.game.players.find((p: Player) => p.id === playerId);
          if (foundPlayer) {
            if (!foundPlayer.answers) foundPlayer.answers = {};
            setPlayer(foundPlayer);
            const curQ = data.game.questions[data.game.currentQuestionIndex];
            if (curQ) setHasSubmitted(foundPlayer.answers?.[curQ.id] !== undefined);
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

  // ---- Re-join sala al conectar ----
  useEffect(() => {
    if (!connected) return;
    const playerId = localStorage.getItem("playerId");
    const playerName = localStorage.getItem("playerName");
    if (playerId && playerName) {
      emit("join-game", { gameId, playerId, playerName });
    }
  }, [connected, emit, gameId]);

  // ---- Socket listeners ----
  useEffect(() => {
    if (!connected) return;

    const handleJoined = (data: { player: Player; game: Game }) => {
      console.log("[GamePage] joined");
      localStorage.setItem("playerId", data.player.id);
      localStorage.setItem("playerName", data.player.name);
      setPlayer(data.player);
      setGame(data.game);
      const curQ = data.game.questions[data.game.currentQuestionIndex];
      if (curQ) setHasSubmitted(Boolean(data.player.answers?.[curQ.id]));
      setLoading(false);
    };

    const handleGameStarted = (data: { game: Game; currentQuestion: Question; timeLeft: number }) => {
      console.log("[GamePage] game-started, timeLeft:", data.timeLeft);
      setIsQuestionFinished(false);
      setHasSubmitted(false);
      setPlayerAnswerResult(null);
      const startTime = Date.now() - (data.game.questionTimeLimit - data.timeLeft);
      setGame({ ...data.game, currentQuestionStartTime: startTime });
      const pid = localStorage.getItem("playerId");
      if (pid) {
        const me = data.game.players.find((p) => p.id === pid);
        if (me) setPlayer(me);
      }
    };

    // game-updated: solo actualiza datos de jugadores, NUNCA toca startTime ni estados de pregunta
    const handleGameUpdated = (payload: { game: Game }) => {
      setGame((prev) => ({
        ...payload.game,
        currentQuestionStartTime: prev?.currentQuestionStartTime ?? 0,
      }));
      const pid = localStorage.getItem("playerId");
      if (pid) {
        const me = payload.game.players.find((p) => p.id === pid);
        if (me) setPlayer(me);
      }
      prevQuestionIndexRef.current = payload.game.currentQuestionIndex;
    };

    const handleQuestionFinished = () => {
      console.log("[GamePage] question-finished received");
      setIsQuestionFinished(true);
      // NO llamar request-game-state — causaba que game-state reiniciara el timer
    };

    const handleQuestionChanged = (data: { question: Question; questionIndex: number; timeLeft: number }) => {
      console.log("[GamePage] question-changed, index:", data.questionIndex, "timeLeft:", data.timeLeft);
      setIsQuestionFinished(false);
      setHasSubmitted(false);
      setPlayerAnswerResult(null);
      setGame((prev) => {
        if (!prev) return prev;
        const startTime = Date.now() - (prev.questionTimeLimit - data.timeLeft);
        return { ...prev, currentQuestionIndex: data.questionIndex, currentQuestionStartTime: startTime };
      });
    };

    const handleGameState = (payload: { game: Game; currentQuestion: Question | null; currentQuestionIndex: number; timeLeft: number }) => {
      console.log("[GamePage] game-state received, timeLeft:", payload.timeLeft);
      const startTime = payload.timeLeft > 0
        ? Date.now() - (payload.game.questionTimeLimit - payload.timeLeft)
        : 0;
      setGame({ ...payload.game, currentQuestionStartTime: startTime });
      const pid = localStorage.getItem("playerId");
      if (pid) {
        const me = payload.game.players.find((p) => p.id === pid);
        if (me) {
          setPlayer(me);
          const curQ = payload.game.questions[payload.currentQuestionIndex];
          if (curQ && me.answers?.[curQ.id] !== undefined) {
            setHasSubmitted(true);
            setPlayerAnswerResult({
              correct: me.answers[curQ.id] === curQ.correctAnswer,
              score: me.score || 0,
            });
          }
        }
      }
    };

    const handleGameFinished = (data: { results: any }) => {
      console.log("[GamePage] game-finished");
      setResults(data.results);
      setGame((prev) => prev ? { ...prev, status: "finished" } : prev);
    };

    const handleJoinError = (payload: any) => {
      console.error("[GamePage] join-error:", payload);
      alert(payload?.message || "Failed to join the game");
    };

    const handlePlayerLeft = (payload: { playerId: string; game: Game }) => {
      setGame((prev) => ({ ...payload.game, currentQuestionStartTime: prev?.currentQuestionStartTime ?? 0 }));
    };

    on("joined", handleJoined);
    on("game-started", handleGameStarted);
    on("game-updated", handleGameUpdated);
    on("question-finished", handleQuestionFinished);
    on("question-changed", handleQuestionChanged);
    on("game-state", handleGameState);
    on("game-finished", handleGameFinished);
    on("join-error", handleJoinError);
    on("player-left", handlePlayerLeft);

    return () => {
      off("joined", handleJoined);
      off("game-started", handleGameStarted);
      off("game-updated", handleGameUpdated);
      off("question-finished", handleQuestionFinished);
      off("question-changed", handleQuestionChanged);
      off("game-state", handleGameState);
      off("game-finished", handleGameFinished);
      off("join-error", handleJoinError);
      off("player-left", handlePlayerLeft);
    };
  }, [connected, emit, on, off, gameId]);

  // ---- Join Form ----
  const JoinForm = () => {
    const [name, setName] = useState<string>(localStorage.getItem("playerName") || "");
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
        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
          Join Game
        </button>
      </form>
    );
  };

  const handleLeaveGame = () => {
    const playerId = localStorage.getItem("playerId");
    if (!playerId) return;
    emit("leave-game", { gameId, playerId });
    localStorage.removeItem("playerId");
    localStorage.removeItem("playerName");
    setPlayer(null);
  };

  const handleAnswerSubmit = (answerIndex: number) => {
    if (!player || !game || hasSubmitted || timerFinished) return;
    const curQ = game.questions[game.currentQuestionIndex];
    if (!curQ) return;
    console.log("[GamePage] submitting answer:", answerIndex, "for question:", curQ.id);
    setHasSubmitted(true);
    setPlayerAnswerResult({ correct: answerIndex === curQ.correctAnswer, score: player.score || 0 });
    setPlayer((prev) => prev ? { ...prev, answers: { ...prev.answers, [curQ.id]: answerIndex } } : prev);
    emit("submit-answer", { gameId, playerId: player.id, questionId: curQ.id, answer: answerIndex });
  };

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
          <CardHeader><CardTitle className="text-center text-red-600">Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-300">{error || "Game not found"}</p>
          </CardContent>
        </Card>
      </div>
    );

  if (!player)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle className="text-center">Join the Quiz</CardTitle></CardHeader>
          <CardContent><JoinForm /></CardContent>
        </Card>
      </div>
    );

  const activeQuestion = game.questions[game.currentQuestionIndex];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{game.name}</h1>
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
            <CardContent className="pt-6 text-center text-yellow-800 dark:text-yellow-200 space-y-4">
              <p>Waiting for the game to start...</p>
              <button onClick={handleLeaveGame} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm">
                Leave game
              </button>
            </CardContent>
          </Card>
        )}

        {/* Active - question in progress */}
        {game.status === "active" && !isQuestionFinished && activeQuestion && (
          <QuestionCard
            question={activeQuestion}
            onAnswerSubmit={handleAnswerSubmit}
            disabled={hasSubmitted || timerFinished}
            timeLeft={timeLeft}
            timeLimit={game.questionTimeLimit}
          />
        )}

        {/* Active - submitted, waiting */}
        {game.status === "active" && hasSubmitted && !isQuestionFinished && (
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <CardContent className="pt-6 text-center text-blue-800 dark:text-blue-200">
              Answer submitted! Waiting for time to run out...
            </CardContent>
          </Card>
        )}

        {/* Active - question finished */}
        {game.status === "active" && isQuestionFinished && (
          <Card className={`border-2 ${
            !playerAnswerResult
              ? "bg-gray-50 border-gray-300 dark:bg-gray-800/30 dark:border-gray-600"
              : playerAnswerResult.correct
              ? "bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600"
              : "bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600"
          }`}>
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              {!playerAnswerResult ? (
                <>
                  <p className="text-4xl">⏱️</p>
                  <p className="text-xl font-bold text-gray-700 dark:text-gray-200">Time's up!</p>
                  <p className="text-gray-500 dark:text-gray-400">You didn't answer in time</p>
                </>
              ) : playerAnswerResult.correct ? (
                <>
                  <p className="text-4xl">✅</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">Correct!</p>
                  <p className="text-green-600 dark:text-green-400 font-medium">Score: {playerAnswerResult.score}</p>
                </>
              ) : (
                <>
                  <p className="text-4xl">❌</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">Wrong answer</p>
                  <p className="text-gray-500 dark:text-gray-400">Better luck next time!</p>
                </>
              )}
              <p className="text-sm text-gray-400 dark:text-gray-500 pt-2">Waiting for next question...</p>
            </CardContent>
          </Card>
        )}

        {/* Finished */}
        {game.status === "finished" && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-center text-2xl">🏆 Quiz Finished!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results ? (
                <>
                  <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                    {results.totalPlayers} players · {results.totalQuestions} questions
                  </p>
                  <div className="space-y-2">
                    {[...results.leaderboard].sort((a, b) => b.score - a.score).map((entry, i) => {
                      const isMe = entry.playerId === player?.id;
                      return (
                        <div key={entry.playerId} className={`flex items-center justify-between p-3 rounded-lg border ${
                          isMe ? "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600" : "bg-gray-50 border-gray-200 dark:bg-gray-800/20 dark:border-gray-700"
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold w-6">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                            <span className={`font-medium ${isMe ? "text-blue-700 dark:text-blue-300" : ""}`}>
                              {entry.name}{isMe ? " (you)" : ""}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{entry.score} pts</p>
                            <p className="text-xs text-gray-500">{entry.correctAnswers}/{entry.totalQuestions} correct</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500">Loading results...</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
