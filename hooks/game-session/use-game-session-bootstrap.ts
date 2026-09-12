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
        const data: unknown = await res.json();
        const game = isGamePayload(data) ? data.game ?? null : null;
        setters.setGame(game);

        const playerId = session.get("playerId");
        const playerName = session.get("playerName");
        const avatarSeed = session.get("playerAvatarSeed");
        if (avatarSeed) setters.setPlayerAvatarSeed(avatarSeed);
        setters.setPlayerAccessories(session.getAccessories());

        if (game && playerId && playerName) {
          const foundPlayer = game.players.find((p) => p.id === playerId);
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
              game.questions[game.currentQuestionIndex];
            if (currentQuestion) {
              setters.setHasSubmitted(
                foundPlayer.answers?.[currentQuestion.id] !== undefined
              );
            }
            syncPhaseFromGame(game, foundPlayer);
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

/** Guard del JSON de red: solo un objeto con `game` puede portar estado. */
function isGamePayload(data: unknown): data is { game?: Game | null } {
  return typeof data === "object" && data !== null && "game" in data;
}
