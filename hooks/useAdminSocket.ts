"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "./useSocket";
import type { Game, Player, Question } from "@/types";

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionEnded, setQuestionEnded] = useState(false);

  const hasRequestedState = useRef(false);

  const { socket, emit, on, off, connected } = useSocket();

  useEffect(() => {
    if (!socket || !connected) return;

    const handlePlayerJoined = (data: { player: Player; game: Game }) => {
      setGame((prev) => ({ ...data.game, currentQuestionStartTime: prev?.currentQuestionStartTime ?? 0 }));
    };

    const handlePlayerLeft = (data: { playerId: string; game: Game }) => {
      setGame((prev) => ({ ...data.game, currentQuestionStartTime: prev?.currentQuestionStartTime ?? 0 }));
    };

    const handleGameUpdated = (data: { game: Game }) => {
      // Nunca tocar currentQuestionStartTime desde game-updated
      setGame((prev) => ({
        ...data.game,
        currentQuestionStartTime: prev?.currentQuestionStartTime ?? 0,
      }));
    };

    const handleGameFinished = (data: { results: any }) => {
      setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
      setQuestionEnded(true);
    };

    const handleQuestionChanged = (data: { question: any; questionIndex: number; timeLeft: number }) => {
      setQuestionEnded(false);
      setGame((prev) => {
        if (!prev) return prev;
        const startTime = Date.now() - (prev.questionTimeLimit - data.timeLeft);
        return { ...prev, currentQuestionIndex: data.questionIndex, currentQuestionStartTime: startTime };
      });
    };

    const handleQuestionFinished = () => {
      setQuestionEnded(true);
      setGame((prev) => prev ? { ...prev, currentQuestionStartTime: 0 } : prev);
    };

    const handleGameState = (data: {
      game: Game;
      currentQuestion: Question | null;
      currentQuestionIndex: number;
      timeLeft: number;
    }) => {
      const { game: incomingGame, currentQuestionIndex, timeLeft } = data;
      const startTime = timeLeft > 0 ? Date.now() - (incomingGame.questionTimeLimit - timeLeft) : 0;
      setGame({ ...incomingGame, currentQuestionIndex, currentQuestionStartTime: startTime });
      setQuestionEnded(startTime === 0 && incomingGame.status === "active");
      setLoading(false);
    };

    const handleGameStarted = (data: { game: Game; timeLeft: number }) => {
      const startTime = Date.now() - (data.game.questionTimeLimit - data.timeLeft);
      setGame({ ...data.game, currentQuestionStartTime: startTime });
      setQuestionEnded(false);
    };

    on("player-joined", handlePlayerJoined);
    on("player-left", handlePlayerLeft);
    on("game-updated", handleGameUpdated);
    on("game-finished", handleGameFinished);
    on("game-state", handleGameState);
    on("game-started", handleGameStarted);
    on("question-changed", handleQuestionChanged);
    on("question-finished", handleQuestionFinished);

    return () => {
      off("player-joined", handlePlayerJoined);
      off("player-left", handlePlayerLeft);
      off("game-updated", handleGameUpdated);
      off("game-finished", handleGameFinished);
      off("game-state", handleGameState);
      off("game-started", handleGameStarted);
      off("question-changed", handleQuestionChanged);
      off("question-finished", handleQuestionFinished);
    };
  }, [socket, connected, on, off]);

  useEffect(() => {
    if (!socket || !connected || hasRequestedState.current) return;
    emit("join-admin", gameId);
    emit("request-game-state", { gameId });
    hasRequestedState.current = true;
  }, [socket, connected, emit, gameId]);

  return { game, setGame, emit, loading, questionEnded };
};
