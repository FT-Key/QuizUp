"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSocket } from "./useSocket";
import type { Game, Player, Question, GameResults } from "@/types";

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);

  const hasRequestedState = useRef(false);

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

            // 🔹 Solo log y toast opcional
            // Si querés, podés agregar un toast aquí:
            // toast(`${player.name} se unió al juego!`);
          },
        },
        {
          event: "game-updated",
          callback: ({ game: updatedGame }: { game: Game }) => {
            console.log("[useAdminSocket] game-updated, status:", updatedGame.status);
            console.log("[useAdminSocket] game-updated, players:", updatedGame.players.map((p) => ({
              name: p.name, id: p.id, answers: p.answers, score: p.score,
            })));
            setGame(updatedGame);
          },
        },
        {
          event: "game-finished",
          callback: (data: { game: Game; results: GameResults }) => {
            console.log("[useAdminSocket] game-finished, game:", data.game);
            console.log("[useAdminSocket] game-finished, results:", data.results);
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
          event: "game-state",
          callback: (data: {
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
          },
        },
      ],
      []
    ),
  });

  useEffect(() => {
    if (!socket || !gameId || !connected || hasRequestedState.current) return;

    console.log("[useAdminSocket] emitting request-game-state", { gameId });
    socket.emit("request-game-state", { gameId });
    hasRequestedState.current = true;
  }, [socket, gameId, connected]);

  return { game, setGame, emit, loading, results };
};
