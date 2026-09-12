"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import type { PlayerSession } from "@/core/application/ports/player-session";
import type { Game, GameResults, Player, Question } from "@/types";
import { GAME_STATUS } from "@/core/domain/game/constants";
import { GAME_PHASE } from "./constants";
import type { GameSessionSetters } from "./types";

export interface UseGameSessionEventsOptions {
  gameId: string;
  session: PlayerSession;
  setters: GameSessionSetters;
  syncPhaseFromGame: (g: Game, me: Player | null | undefined) => void;
}

type Emit = (event: string, data?: unknown) => void;

/** Los 9 eventos del socket del jugador; `useSocket` se llama una sola vez. */
export function useGameSessionEvents({
  gameId,
  session,
  setters,
  syncPhaseFromGame,
}: UseGameSessionEventsOptions): {
  emit: Emit;
  emitRef: MutableRefObject<Emit | null>;
} {
  const emitRef = useRef<Emit | null>(null);

  const { emit } = useSocket({
    gameId,
    events: useMemo(
      () => [
        {
          event: "joined",
          callback: (data: { player: Player; game: Game }) => {
            if (data.player) {
              session.set("playerId", data.player.id);
              session.set("playerName", data.player.name);
              setters.setPlayer(data.player);
              if (data.player.avatar?.seed) {
                setters.setPlayerAvatarSeed(data.player.avatar.seed);
              }
              if (data.player.avatar?.accessories) {
                setters.setPlayerAccessories(data.player.avatar.accessories);
              }
            }
            if (data.game) {
              setters.setGame(data.game);
              const curQ = data.game.questions[data.game.currentQuestionIndex];
              if (data.player && curQ) {
                setters.setHasSubmitted(
                  Boolean(
                    data.player.answers &&
                      data.player.answers[curQ.id] !== undefined
                  )
                );
              }
              syncPhaseFromGame(data.game, data.player);
            }
            setters.setLoading(false);
          },
        },
        {
          event: "game-started",
          callback: (data: {
            game: Game;
            players: Player[];
            currentQuestion: Question;
          }) => {
            setters.setIsQuestionFinished(false);
            setters.setHasSubmitted(false);
            setters.setPlayerAnswerResult(null);
            setters.setGame(data.game);
            setters.setGamePhase(GAME_PHASE.QUESTION);

            const lb = data.game.players.map((p) => ({
              playerId: p.id,
              score: p.score,
            }));
            setters.setPreviousLeaderboard(lb);

            const pid = session.get("playerId");
            if (pid) {
              const found = data.game.players.find((p) => p.id === pid);
              if (found) setters.setPlayer(found);
            }
          },
        },
        {
          event: "game-updated",
          callback: (payload: { game: Game }) => {
            const updatedGame = payload.game;
            setters.setGame(updatedGame);

            const pid = session.get("playerId");
            if (pid) {
              const found = updatedGame.players.find((p) => p.id === pid);
              if (found) {
                setters.setPlayer(found);
                const curQ =
                  updatedGame.questions[updatedGame.currentQuestionIndex];
                if (curQ) {
                  const hasAnswer =
                    found.answers && found.answers[curQ.id] !== undefined;

                  setters.setHasSubmitted(Boolean(hasAnswer));
                }
              }
            }

            const curQ = updatedGame.questions[updatedGame.currentQuestionIndex];
            if (curQ) {
              const allAnswered = updatedGame.players.every(
                (p) => p.answers?.[curQ.id] !== undefined
              );

              setters.setIsQuestionFinished(allAnswered);
              if (allAnswered) {
                const pid2 = session.get("playerId");
                if (pid2) {
                  const me = updatedGame.players.find((p) => p.id === pid2);
                  if (me) {
                    const playerAns = me.answers?.[curQ.id];

                    if (playerAns !== undefined) {
                      setters.setPlayerAnswerResult({
                        correct: playerAns === curQ.correctAnswer,
                        score: me.score || 0,
                      });
                    }
                  }
                }
              }
            }
          },
        },
        {
          event: "question-finished",
          callback: () => {
            setters.setIsQuestionFinished(true);
            setters.setGamePhase(GAME_PHASE.SHOWING_RESULT);
            emitRef.current?.("request-game-state", { gameId });
          },
        },
        {
          event: "game-state",
          callback: (payload: {
            game: Game;
            currentQuestion: Question | null;
            currentQuestionIndex: number;
            timeLeft: number;
          }) => {
            setters.setGame(payload.game);
            const pid = session.get("playerId");
            if (pid) {
              const found = payload.game.players.find((p) => p.id === pid);
              if (found) {
                setters.setPlayer(found);
                syncPhaseFromGame(payload.game, found);
              }
            }
          },
        },
        {
          event: "join-error",
          callback: (payload?: { message?: string }) => {
            toast.error(payload?.message || "Failed to join the game");
          },
        },
        {
          event: "game-finished",
          callback: (data: { game: Game; results: GameResults }) => {
            if (data.game) {
              setters.setGame(data.game);
            } else {
              setters.setGame((prev) =>
                prev ? { ...prev, status: GAME_STATUS.FINISHED } : prev
              );
            }
            if (data.results) {
              setters.setResults(data.results);
            }
          },
        },
        {
          event: "game-cancelled",
          callback: (data: { game: Game }) => {
            if (data.game) {
              setters.setGame(data.game);
            } else {
              setters.setGame((prev) =>
                prev ? { ...prev, status: GAME_STATUS.CANCELLED } : prev
              );
            }
          },
        },
        {
          event: "question-changed",
          callback: (data: {
            question: Question;
            questionIndex: number;
            timeLeft: number;
          }) => {
            setters.setIsQuestionFinished(false);
            setters.setHasSubmitted(false);
            setters.setPlayerAnswerResult(null);
            setters.setGamePhase(GAME_PHASE.QUESTION);
            setters.setGame((prev) => {
              if (!prev) return prev;
              return { ...prev, currentQuestionIndex: data.questionIndex };
            });
          },
        },
      ],
      [gameId, session, syncPhaseFromGame, setters]
    ),
  });

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  return { emit, emitRef };
}
