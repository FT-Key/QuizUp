"use client";

import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Emit } from "@/adapters/socket/socket-event-bus";
import type { PlayerSession } from "@/core/application/ports/player-session";
import type { Game, Player } from "@/types";
import type { GameSessionSetters } from "./types";

/** Fetch inicial del juego + re-join con la sesión persistida (una vez por `gameId`). */
export function useGameSessionBootstrap({
  gameId,
  session,
  setters,
  syncPhaseFromGame,
  emitRef,
}: {
  gameId: string;
  session: PlayerSession;
  setters: GameSessionSetters;
  syncPhaseFromGame: (g: Game, me: Player | null | undefined) => void;
  emitRef: MutableRefObject<Emit | null>;
}): void {
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        if (!res.ok) throw new Error("Game not found");
        const data = (await res.json()) as { game: Game };
        setters.setGame(data.game);

        const playerId = session.get("playerId");
        const playerName = session.get("playerName");
        const avatarSeed = session.get("playerAvatarSeed");
        if (avatarSeed) setters.setPlayerAvatarSeed(avatarSeed);
        setters.setPlayerAccessories(session.getAccessories());

        if (playerId && playerName) {
          const foundPlayer = data.game.players.find((p) => p.id === playerId);
          if (foundPlayer) {
            if (!foundPlayer.answers) foundPlayer.answers = {};
            setters.setPlayer(foundPlayer);
            emitRef.current?.("join-game", {
              gameId,
              playerId,
              avatar: {
                seed: avatarSeed || playerName, // "" es inválido: fallback intencional
                accessories: session
                  .getAccessories()
                  .filter((a) => a !== "none"),
              },
            });

            const currentQuestion =
              data.game.questions[data.game.currentQuestionIndex];
            if (currentQuestion) {
              setters.setHasSubmitted(
                foundPlayer.answers?.[currentQuestion.id] !== undefined
              );
            }
            syncPhaseFromGame(data.game, foundPlayer);
          }
        }
      } catch {
        setters.setError("Failed to load game");
      } finally {
        setters.setLoading(false);
      }
    };

    if (gameId) fetchGame();
  }, [gameId, session, syncPhaseFromGame, setters, emitRef]);
}
