"use client";

import type { MutableRefObject } from "react";
import type { Emit } from "@/adapters/socket/socket-event-bus";
import type { PlayerSession } from "@/core/application/ports/player-session";
import type { Game, Player } from "@/types";
import type {
  GameSessionActions,
  GameSessionSetters,
  JoinGamePayload,
} from "./types";

/** Acciones `join` y `submitAnswer` (mismos cuerpos y guards que el hook original). */
export function useGameSessionActions({
  gameId,
  game,
  player,
  session,
  setters,
  emitRef,
}: {
  gameId: string;
  game: Game | null;
  player: Player | null;
  session: PlayerSession;
  setters: GameSessionSetters;
  emitRef: MutableRefObject<Emit | null>;
}): GameSessionActions {
  const join = ({
    playerName,
    avatarSeed,
    avatarAccessories = [],
  }: JoinGamePayload) => {
    const trimmed = playerName.trim();
    session.set("playerName", trimmed);
    if (avatarSeed) session.set("playerAvatarSeed", avatarSeed);
    if (avatarAccessories.length > 0) session.setAccessories(avatarAccessories);
    emitRef.current?.("join-game", {
      gameId,
      playerName: trimmed,
      avatar: {
        seed: avatarSeed || trimmed, // "" es inválido: fallback intencional
        accessories: avatarAccessories.filter((a) => a !== "none"),
      },
    });
  };

  const submitAnswer = (answerIndex: number) => {
    if (!player || !game) return;
    const currentQuestion = game.questions[game.currentQuestionIndex];
    if (!currentQuestion) return;

    emitRef.current?.("submit-answer", {
      gameId,
      playerId: player.id,
      questionId: currentQuestion.id,
      answer: answerIndex,
    });

    setters.setPlayer((prev) =>
      prev
        ? {
            ...prev,
            answers: { ...prev.answers, [currentQuestion.id]: answerIndex },
          }
        : prev
    );
    setters.setHasSubmitted(true);
    setters.setPlayerAnswerResult({
      correct: answerIndex === currentQuestion.correctAnswer,
      score: player.score ?? 0,
    });
  };

  return { join, submitAnswer };
}
