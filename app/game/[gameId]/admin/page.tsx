"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { GameInfo } from "@/components/admin/GameInfo";
import { GameControls } from "@/components/admin/GameControls";
import { QuestionPreview } from "@/components/admin/QuestionPreview";
import { PlayerList } from "@/components/PlayerList";
import { Results } from "@/components/Results";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import { useQuestionTimer } from "@/hooks/useQuestionTimer";

export default function AdminPage() {
  const { gameId } = useParams();
  const { game, setGame, emit, loading, results } = useAdminSocket(gameId as string);

  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Debug: log game state changes
  useEffect(() => {
    if (game) {
      console.log("[AdminPage] game state changed:", {
        status: game.status,
        currentQuestionIndex: game.currentQuestionIndex,
        players: game.players.map((p) => ({
          name: p.name,
          id: p.id,
          answers: p.answers,
          score: p.score,
        })),
      });
      if (game.players.length > 0) {
        const q = game.questions[game.currentQuestionIndex];
        console.log("[AdminPage] currentQuestion:", q?.id, "correctAnswer:", q?.correctAnswer);
        for (const p of game.players) {
          console.log(`[AdminPage] player ${p.name} answer for q ${q?.id}:`, p.answers?.[q?.id]);
        }
      }
    }
  }, [game]);

  useEffect(() => {
    if (results) {
      console.log("[AdminPage] results:", JSON.stringify(results, null, 2));
    }
  }, [results]);

  const { timeLeft, isFinished } = useQuestionTimer(
    game?.currentQuestionStartTime ?? 0,
    game?.questionTimeLimit ?? 30000
  );

  const questionEnded = game?.status !== "active" || isFinished;
  const currentQuestion = game?.questions[game?.currentQuestionIndex];

  // ---- Handlers ----
  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start game");
      const data = await res.json();
      setGame(data.game);
      emit("start-game", { gameId });
    } catch (err) {
      console.error(err);
      alert("Failed to start game.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinishGame = async () => {
    setIsFinishing(true);
    try {
      emit("finish-game", { gameId });
    } catch (err) {
      console.error(err);
      alert("Failed to finish game.");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleNextQuestion = () => {
    emit("next-question", { gameId });
    setGame((prev) =>
      prev
        ? {
            ...prev,
            currentQuestionIndex: prev.currentQuestionIndex + 1,
            currentQuestionStartTime: Date.now(),
          }
        : prev
    );
  };

  const handleForceEnd = () => {
    emit("finish-question", { gameId });
    setGame((prev) =>
      prev
        ? {
            ...prev,
            currentQuestionStartTime:
              Date.now() - (prev.questionTimeLimit || 30000),
          }
        : prev
    );
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading admin view...</p>
      </div>
    );
  }

  const playersWithAnswers = currentQuestion
    ? game.players.filter((p) => p.answers?.[currentQuestion.id] !== undefined)
        .length
    : 0;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <GameInfo
          game={game}
          timeLeft={timeLeft}
          questionEnded={questionEnded}
        />

        <GameControls
          gameStatus={game.status}
          currentQuestionIndex={game.currentQuestionIndex}
          totalQuestions={game.questions.length}
          isStarting={isStarting}
          isFinishing={isFinishing}
          questionEnded={questionEnded}
          onStart={handleStartGame}
          onFinish={handleFinishGame}
          onNextQuestion={handleNextQuestion}
          onForceEnd={handleForceEnd}
          hasPlayers={game.players.length > 0}
        />

        {currentQuestion && (
          <QuestionPreview
            question={currentQuestion}
            showAnswer={questionEnded}
            playersWithAnswers={playersWithAnswers}
            totalPlayers={game.players.length}
          />
        )}

        <PlayerList players={game.players} gameStatus={game.status} currentQuestion={currentQuestion} />

        {game.status === "finished" && <Results gameId={gameId as string} results={results} />}
      </div>
    </div>
  );
}
