"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";
import type { Game } from "@/types";
import { GAME_STATUS } from "@/core/domain/game/constants";
import { FALLBACK_QUESTION_TIME_LIMIT_MS } from "@/constants/game";

export interface UseAdminActionsOptions {
  gameId: string;
  game: Game | null;
  setGame: Dispatch<SetStateAction<Game | null>>;
  emit: (event: string, data?: unknown) => void;
}

export interface AdminActions {
  isStarting: boolean;
  isFinishing: boolean;
  /** POST /api/games/:id/start → setGame(data.game) → emit start-game. */
  startGame(): Promise<void>;
  /** emit finish-game (con su catch/toast legacy). */
  finishGame(): Promise<void>;
  /** emit + index+1 + startTime Date.now(). */
  nextQuestion(): void;
  /** emit finish-question + startTime Date.now() - (limit || 30000). */
  forceEndQuestion(): void;
  kickPlayer(playerId: string): void;
  /** if (!game) return; emit lock-game con !game.locked. */
  toggleLock(): void;
  /** emit close-game + status:"cancelled" optimista. */
  closeGame(): void;
}

/** Acciones del admin (Command, US-14): 7 comandos + flags en un solo punto. */
export function useAdminActions({
  gameId,
  game,
  setGame,
  emit,
}: UseAdminActionsOptions): AdminActions {
  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const startGame = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start game");
      const data = (await res.json()) as { game: Game };
      setGame(data.game);
      emit("start-game", { gameId });
    } catch {
      toast.error("Failed to start game.");
    } finally {
      setIsStarting(false);
    }
  };

  const finishGame = async () => {
    setIsFinishing(true);
    try {
      emit("finish-game", { gameId });
    } catch {
      toast.error("Failed to finish game.");
    } finally {
      setIsFinishing(false);
    }
  };

  const nextQuestion = () => {
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

  const forceEndQuestion = () => {
    emit("finish-question", { gameId });
    setGame((prev) =>
      prev
        ? {
            ...prev,
            currentQuestionStartTime:
              Date.now() - (prev.questionTimeLimit || FALLBACK_QUESTION_TIME_LIMIT_MS),
          }
        : prev
    );
  };

  const kickPlayer = (playerId: string) => {
    emit("leave-game", { gameId, playerId });
  };

  const toggleLock = () => {
    if (!game) return;
    emit("lock-game", { gameId, locked: !game.locked });
  };

  const closeGame = () => {
    emit("close-game", { gameId });
    setGame((prev) => (prev ? { ...prev, status: GAME_STATUS.CANCELLED } : prev));
  };

  return {
    isStarting,
    isFinishing,
    startGame,
    finishGame,
    nextQuestion,
    forceEndQuestion,
    kickPlayer,
    toggleLock,
    closeGame,
  };
}
