"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { GameInfo } from "@/components/admin/GameInfo";
import { GameControls } from "@/components/admin/GameControls";
import { QuestionPreview } from "@/components/admin/QuestionPreview";
import { PlayerList } from "@/components/PlayerList";
import { Results } from "@/components/Results";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import { useQuestionTimer } from "@/hooks/useQuestionTimer";

export default function AdminPage() {
  // ---- Validación de gameId ----
  const { gameId: rawGameId } = useParams();
  if (!rawGameId || Array.isArray(rawGameId)) {
    throw new Error("Invalid gameId in URL");
  }
  const gameId = rawGameId; // ahora es seguro como string

  // ---- Hook de socket ----
  const { game, setGame, emit, loading, questionEnded } = useAdminSocket(gameId);

  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const currentQuestion = game?.questions[game?.currentQuestionIndex ?? 0];

  const { timeLeft } = useQuestionTimer(
    game?.currentQuestionStartTime ?? 0,
    game?.questionTimeLimit ?? 30000,
    currentQuestion?.id
  );

  // ---- Handlers ----
  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start game");
      // No usamos data.game aquí — el timer se sincroniza via game-started del WS
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
      const res = await fetch(`/api/games/${gameId}/finish`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to finish game");
      setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
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
    // El estado se actualiza via question-changed o game-finished del servidor
  };

  const handleForceEnd = () => {
    emit("finish-question", { gameId });
    // El estado se actualiza via question-finished del servidor
  };

  // ---- Loading ----
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

        <PlayerList players={game.players} gameStatus={game.status} />

        {game.status === "finished" && <Results gameId={gameId} />}
      </div>
    </div>
  );
}
