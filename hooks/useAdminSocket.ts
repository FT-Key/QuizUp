"use client";

import { useState, useEffect, useMemo } from "react";
import { useSocket } from "./useSocket";
import type { Game, Player, Question } from "@/types";

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const { socket, emit } = useSocket({
    gameId,
    isAdmin: true,
    events: useMemo(
      () => [
        {
          event: "player-joined",
          callback: ({ player }: { player: Player }) => {
            setGame((prev) =>
              prev && !prev.players.some((p) => p.id === player.id)
                ? { ...prev, players: [...prev.players, player] }
                : prev
            );
          },
        },
        {
          event: "game-updated",
          callback: ({ game: updatedGame }: { game: Game }) => {
            setGame(updatedGame);
          },
        },
        {
          event: "game-finished",
          callback: () => {
            setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
          },
        },
        {
          event: "game-state",
          callback: (data: {
            game: Game; // Game completo desde el servidor
            currentQuestion: Question | null;
            currentQuestionIndex: number;
            timeLeft: number;
          }) => {
            setGame((prev) => {
              const baseGame = prev || data.game;
              return {
                ...baseGame,
                currentQuestionIndex: data.currentQuestionIndex,
                currentQuestionStartTime:
                  Date.now() - (data.game.questionTimeLimit - data.timeLeft),
                players: data.game.players,
                status: data.game.status,
              };
            });

            setLoading(false);
          },
        },
      ],
      []
    ),
  });

  // Solicitud inicial de estado del juego
  useEffect(() => {
    if (!socket || !gameId) return;
    socket.emit("request-game-state", { gameId });
  }, [socket, gameId]);

  return { game, setGame, emit, loading };
};
