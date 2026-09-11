"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSocket } from "./useSocket";
import type { Game, Player, Question, GameResults } from "@/types";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);

  const triedHttpFallback = useRef(false);

  const { socket, emit, connected } = useSocket({
    gameId,
    isAdmin: true,
    events: useMemo(
      () => [
        {
          event: "player-joined",
          callback: ({
            player,
          }: {
            player: Player;
            game: Game;
          }) => {

          },
        },
        {
          event: "player-left",
          callback: ({
            playerId,
            game: updatedGame,
          }: {
            playerId: string;
            game: Game;
          }) => {

            if (updatedGame) {
              setGame(updatedGame);
            } else {
              setGame((prev) =>
                prev
                  ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) }
                  : prev
              );
            }
          },
        },
        {
          event: "game-updated",
          callback: ({ game: updatedGame }: { game: Game }) => {

            setGame((prev) => ({
              ...updatedGame,
              currentQuestionStartTime:
                updatedGame.currentQuestionStartTime === 0 && prev
                  ? prev.currentQuestionStartTime
                  : updatedGame.currentQuestionStartTime,
            }));

            setLoading(false);
          },
        },
        {
          event: "question-finished",
          callback: (data: { currentQuestionIndex: number }) => {

            setGame((prev) =>
              prev
                ? {
                    ...prev,
                    currentQuestionStartTime:
                      Date.now() - (prev.questionTimeLimit || 30000),
                  }
                : prev
            );
          },
        },
        {
          event: "game-finished",
          callback: (data: { game: Game; results: GameResults }) => {

            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
            }
            if (data.results) {
              setResults(data.results);
            }
            setLoading(false);
          },
        },
        {
          event: "game-cancelled",
          callback: (data: { game: Game }) => {

            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) =>
                prev ? { ...prev, status: "cancelled" } : prev
              );
            }
            setLoading(false);
          },
        },
        {
          event: "game-state",
          callback: (data: {
            game: Game;
            currentQuestion: Question | null;
            currentQuestionIndex: number;
            timeLeft: number;
          }) => {

            const { game: incomingGame, currentQuestionIndex, timeLeft } = data;
            setGame({
              ...incomingGame,
              currentQuestionIndex,
              currentQuestionStartTime:
                Date.now() - ((incomingGame.questionTimeLimit || 30000) - timeLeft),
            });
            setLoading(false);
          },
        },
      ],
      []
    ),
  });

  const fetchGameViaHttp = async () => {
    try {

      const res = await fetch(`/api/games/${gameId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.game) {
          setGame(data.game);
          setLoading(false);
        }
      }
    } catch (err) {

    }
  };

  useEffect(() => {
    if (!socket || !gameId || !connected) return;

    socket.emit("request-game-state", { gameId });
  }, [socket, gameId, connected]);

  useEffect(() => {
    if (!loading) return;

    if (retryTick >= MAX_RETRIES) {
      if (!triedHttpFallback.current) {
        triedHttpFallback.current = true;
        fetchGameViaHttp();
      }
      return;
    }

    const timer = setTimeout(() => {
      setRetryTick((t) => t + 1);
    }, RETRY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [loading, retryTick]);

  useEffect(() => {
    if (retryTick === 0 || !loading) return;
    if (retryTick <= MAX_RETRIES && socket && connected) {

      socket.emit("request-game-state", { gameId });
    }
  }, [retryTick, socket, connected, gameId, loading]);

  useEffect(() => {
    if (!connected) return;
    if (loading && socket) {
      socket.emit("request-game-state", { gameId });
    }
  }, [connected]);

  return { game, setGame, emit, loading, results };
};
