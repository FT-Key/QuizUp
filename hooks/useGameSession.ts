"use client";

import { usePlayerSession } from "@/hooks/usePlayerSession";
import { useGameSessionActions } from "./game-session/use-game-session-actions";
import { useGameSessionBootstrap } from "./game-session/use-game-session-bootstrap";
import { useGameSessionEvents } from "./game-session/use-game-session-events";
import { useGameSessionState } from "./game-session/use-game-session-state";
import type { UseGameSessionResult } from "./game-session/types";

export type {
  GamePhase,
  PreviousLeaderboardEntry,
  GameSessionAvatar,
  JoinGamePayload,
  GameSessionActions,
  UseGameSessionResult,
} from "./game-session/types";

/**
 * Facade del estado del jugador (US-14, dividido en sub-hooks en US-17):
 * composición estado → eventos → bootstrap → acciones. La página solo
 * consume `{ game, player, phase, actions }`.
 */
export function useGameSession(gameId: string): UseGameSessionResult {
  const session = usePlayerSession();
  const { state, setters, syncPhaseFromGame } = useGameSessionState();
  const { emitRef } = useGameSessionEvents({
    gameId,
    session,
    setters,
    syncPhaseFromGame,
  });
  useGameSessionBootstrap({
    gameId,
    session,
    setters,
    syncPhaseFromGame,
    emitRef,
  });
  const actions = useGameSessionActions({
    gameId,
    game: state.game,
    player: state.player,
    session,
    setters,
    emitRef,
  });

  return {
    game: state.game,
    player: state.player,
    loading: state.loading,
    error: state.error,
    phase: state.gamePhase,
    hasSubmitted: state.hasSubmitted,
    isQuestionFinished: state.isQuestionFinished,
    playerAnswerResult: state.playerAnswerResult,
    previousLeaderboard: state.previousLeaderboard,
    results: state.results,
    avatar: {
      // "" es inválido: fallback intencional
      seed: state.playerAvatarSeed || state.player?.name || "",
      accessories: state.playerAccessories,
    },
    actions,
  };
}
