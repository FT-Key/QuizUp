"use client";

import { useState, useEffect, useMemo } from "react";
import { useSocket } from "./useSocket";
import type { Game, GameState, Player } from "@/types";

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);

  // ---- Fetch inicial del juego ----
  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        if (!res.ok) throw new Error("Game not found");
        const data = await res.json();
        setGame(data.game);
        console.log("Game response: ", data.game);
      } catch (err) {
        console.error("Failed to fetch game:", err);
      }
    };

    fetchGame();
  }, [gameId]);

  // ---- Memoizar eventos ----
  const events = useMemo(
    () => [
      {
        event: "player-joined",
        callback: ({ player }: { player: Player }) => {
          setGame((prev) => {
            if (!prev) return prev;
            if (prev.players.some((p) => p.id === player.id)) return prev;
            return { ...prev, players: [...prev.players, player] };
          });
        },
      },
      {
        event: "game-updated",
        callback: ({ game: updatedGame }: GameState) => {
          setGame(updatedGame);
        },
      },
      {
        event: "game-finished",
        callback: () => {
          setGame((prev) => (prev ? { ...prev, status: "finished" } : null));
        },
      },
    ],
    []
  );

  // ---- Integrar socket ----
  const { socket, emit } = useSocket({
    gameId,
    events,
  });

  // ---- Emitir join-admin al conectarse ----
  useEffect(() => {
    if (!socket) return;
    socket.emit("join-admin", gameId);
    console.log("Admin joined game:", gameId);
  }, [socket, gameId]);

  return { game, setGame, emit };
};
