"use client";

import { useState, useEffect, useMemo } from "react";
import { useSocket } from "./useSocket";
import type { Game, Player, Question } from "@/types";

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const { socket, emit, connected } = useSocket({
    gameId,
    isAdmin: true,
    events: useMemo(
      () => [
        {
          event: "player-joined",
          callback: ({
            player,
            game: updatedGame,
          }: {
            player: Player;
            game: Game;
          }) => {
            console.log("[useAdminSocket] player-joined ->", player);
            setGame((prev) => {
              if (!prev) return updatedGame;
              // Evitar duplicados
              const exists = prev.players.some((p) => p.id === player.id);
              return exists
                ? { ...prev, ...updatedGame } // actualizar info completa
                : { ...prev, players: [...prev.players, player] };
            });
          },
        },
        {
          event: "game-updated",
          callback: ({ game: updatedGame }: { game: Game }) => {
            console.log("[useAdminSocket] game-updated", updatedGame);
            setGame(updatedGame);
          },
        },
        {
          event: "game-finished",
          callback: () => {
            console.log("[useAdminSocket] game-finished");
            setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
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
            console.log("[useAdminSocket] game-state received:", data);
            setGame({
              ...data.game,
              currentQuestionIndex: data.currentQuestionIndex,
              currentQuestionStartTime:
                Date.now() - (data.game.questionTimeLimit - data.timeLeft),
              players: data.game.players,
              status: data.game.status,
            });
            setLoading(false);
          },
        },
      ],
      []
    ),
  });

  // Solicitar estado actual del juego al conectar
  useEffect(() => {
    if (!socket || !gameId) return;
    console.log("[useAdminSocket] emitting request-game-state", {
      connected,
      gameId,
    });
    socket.emit("request-game-state", { gameId });
  }, [socket, gameId, connected]);

  return { game, setGame, emit, loading };
};
