"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  resolveGamePhase,
  type PlayerAnswerResult,
} from "@/core/domain/game/phase-resolver";
import type { Game, GameResults, Player } from "@/types";
import { GAME_PHASE, SCOREBOARD_PHASE_DELAY_MS } from "./constants";
import type {
  GamePhase,
  GameSessionSetters,
  GameSessionState,
  PreviousLeaderboardEntry,
} from "./types";

export interface GameSessionStateApi {
  /** Valores actuales (objeto nuevo por render). */
  state: GameSessionState;
  /** Estable: `useMemo(() => ({...}), [])`; los setters de `useState` no cambian. */
  setters: GameSessionSetters;
  syncPhaseFromGame(g: Game, me: Player | null | undefined): void;
}

/**
 * Los 12 estados del jugador + el timer de 4 s de `showing-result`.
 * No conoce socket ni red: expone setters estables para los demás sub-hooks.
 */
export function useGameSessionState(): GameSessionStateApi {
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState<GameResults | null>(null);
  const [isQuestionFinished, setIsQuestionFinished] = useState(false);
  const [playerAnswerResult, setPlayerAnswerResult] =
    useState<PlayerAnswerResult | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>(GAME_PHASE.WAITING);
  const [playerAvatarSeed, setPlayerAvatarSeed] = useState<string>("");
  const [playerAccessories, setPlayerAccessories] = useState<string[]>([]);
  const [previousLeaderboard, setPreviousLeaderboard] = useState<
    PreviousLeaderboardEntry[]
  >([]);

  const syncPhaseFromGame = useCallback(
    (g: Game, me: Player | null | undefined) => {
      const resolution = resolveGamePhase(g, me, Date.now());
      if (!resolution) return;

      setHasSubmitted(resolution.hasSubmitted);
      setIsQuestionFinished(resolution.questionFinished);
      setPlayerAnswerResult(resolution.answerResult);
      setGamePhase(resolution.phase);
    },
    []
  );

  useEffect(() => {
    if (gamePhase === GAME_PHASE.SHOWING_RESULT) {
      const timer = setTimeout(() => {
        setGamePhase(GAME_PHASE.SHOWING_SCOREBOARD);
      }, SCOREBOARD_PHASE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [gamePhase]);

  const setters = useMemo<GameSessionSetters>(
    () => ({
      setGame,
      setPlayer,
      setLoading,
      setError,
      setHasSubmitted,
      setResults,
      setIsQuestionFinished,
      setPlayerAnswerResult,
      setGamePhase,
      setPlayerAvatarSeed,
      setPlayerAccessories,
      setPreviousLeaderboard,
    }),
    []
  );

  const state: GameSessionState = {
    game,
    player,
    loading,
    error,
    hasSubmitted,
    results,
    isQuestionFinished,
    playerAnswerResult,
    gamePhase,
    playerAvatarSeed,
    playerAccessories,
    previousLeaderboard,
  };

  return { state, setters, syncPhaseFromGame };
}
