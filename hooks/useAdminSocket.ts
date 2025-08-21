"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "./useSocket";
import type { Game, Player, Question } from "@/types";

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const hasRequestedState = useRef(false);

  const { socket, emit, on, off, connected } = useSocket();

  // ---- Listeners
  useEffect(() => {
    if (!socket || !connected) return;

    // Jugador se une
    const handlePlayerJoined = (data: { player: Player; game: Game }) => {
      console.log("[useAdminSocket] player-joined ->", data.player);
      // opcional: toast(`${data.player.name} se unió al juego`);
    };

    // Juego actualizado
    const handleGameUpdated = (data: { game: Game }) => {
      console.log("[useAdminSocket] game-updated", data.game);
      setGame(data.game);
    };

    // Juego finalizado
    const handleGameFinished = () => {
      console.log("[useAdminSocket] game-finished");
      setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
    };

    // Estado completo del juego
    const handleGameState = (data: {
      game: Game;
      currentQuestion: Question | null;
      currentQuestionIndex: number;
      timeLeft: number;
    }) => {
      console.log("[useAdminSocket] game-state received:", data);
      const { game: incomingGame, currentQuestionIndex, timeLeft } = data;
      setGame({
        ...incomingGame,
        currentQuestionIndex,
        currentQuestionStartTime:
          Date.now() - (incomingGame.questionTimeLimit - timeLeft),
      });
      setLoading(false);
    };

    // Registrar listeners
    on("player-joined", handlePlayerJoined);
    on("game-updated", handleGameUpdated);
    on("game-finished", handleGameFinished);
    on("game-state", handleGameState);

    // Cleanup al desmontar
    return () => {
      off("player-joined", handlePlayerJoined);
      off("game-updated", handleGameUpdated);
      off("game-finished", handleGameFinished);
      off("game-state", handleGameState);
    };
  }, [socket, connected, on, off]);

  // ---- Solicitar estado inicial del juego
  useEffect(() => {
    if (!socket || !connected || hasRequestedState.current) return;

    console.log("[useAdminSocket] emitting request-game-state", { gameId });
    emit("request-game-state", { gameId });
    hasRequestedState.current = true;
  }, [socket, connected, emit, gameId]);

  return { game, setGame, emit, loading };
};
