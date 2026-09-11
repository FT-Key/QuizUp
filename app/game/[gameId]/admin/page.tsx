"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Results } from "@/components/Results";
import { AdminLobby } from "@/components/admin/AdminLobby";
import { AdminPresentation } from "@/components/admin/AdminPresentation";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import { useQuestionTimer } from "@/hooks/useQuestionTimer";

export default function AdminPage() {
  const { gameId } = useParams();
  const { game, setGame, emit, loading, results } = useAdminSocket(
    gameId as string
  );

  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const { timeLeft, isFinished } = useQuestionTimer(
    game?.currentQuestionStartTime ?? 0,
    game?.questionTimeLimit ?? 30000
  );

  const questionEnded = game?.status !== "active" || isFinished;

  
  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start game");
      const data = await res.json();
      setGame(data.game);
      emit("start-game", { gameId });
    } catch (err) {
      
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

  const handleKick = (playerId: string) => {
    emit("leave-game", { gameId, playerId });
  };

  const handleToggleLock = () => {
    if (!game) return;
    emit("lock-game", { gameId, locked: !game.locked });
  };

  const handleCloseGame = () => {
    emit("close-game", { gameId });
    setGame((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-bold text-gray-600">
            Cargando vista de admin...
          </p>
          <p className="text-sm text-gray-400">
            Si tarda mucho, intenta recargar la página
          </p>
        </div>
      </div>
    );
  }

  
  if (game.status === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 text-center space-y-4">
          <div className="text-6xl">🚪</div>
          <h2 className="text-2xl font-black text-gray-800">
            Partida cerrada
          </h2>
          <p className="text-gray-600">
            Esta partida nunca se inició y fue cerrada por el anfitrión o por
            inactividad.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link
              href="/create"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-bold text-white rounded-full transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #864CBF 0%, #46178F 100%)",
              }}
            >
              Crear otro quiz
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-bold text-white rounded-full transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
              }}
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  
  if (game.status === "waiting") {
    return (
      <AdminLobby
        game={game}
        isStarting={isStarting}
        onStart={handleStartGame}
        onKick={handleKick}
        onToggleLock={handleToggleLock}
        onClose={handleCloseGame}
      />
    );
  }

  
  if (game.status === "active") {
    return (
      <AdminPresentation
        game={game}
        timeLeft={timeLeft}
        questionEnded={questionEnded}
        isFinishing={isFinishing}
        onForceEnd={handleForceEnd}
        onNextQuestion={handleNextQuestion}
        onFinish={handleFinishGame}
      />
    );
  }

  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <Results gameId={gameId as string} results={results} />
      </div>
    </div>
  );
}
