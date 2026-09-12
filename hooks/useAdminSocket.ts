"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSocket, type SocketEvent } from "./useSocket";
import { getGameSessionFacade } from "@/infra/client-container";
import type { Game, Player, Question, GameResults } from "@/types";
import { GAME_STATUS } from "@/core/domain/game/constants";
import { FALLBACK_QUESTION_TIME_LIMIT_MS } from "@/constants/game";

export const useAdminSocket = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);

  const fallbackRequested = useRef(false);
  const gameSession = getGameSessionFacade();

  const { emit, connected } = useSocket({
    gameId,
    isAdmin: true,
    events: useMemo<SocketEvent[]>(
      () => [
        {
          event: "player-joined",
          callback: ({
            player,
          }: {
            player: Player;
            game: Game;
          }) => {

          },
        },
        {
          event: "player-left",
          callback: ({
            playerId,
            game: updatedGame,
          }: {
            playerId: string;
            game: Game;
          }) => {

            if (updatedGame) {
              setGame(updatedGame);
            } else {
              setGame((prev) =>
                prev
                  ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) }
                  : prev
              );
            }
          },
        },
        {
          event: "game-updated",
          callback: ({ game: updatedGame }: { game: Game }) => {

            setGame((prev) => ({
              ...updatedGame,
              currentQuestionStartTime:
                updatedGame.currentQuestionStartTime === 0 && prev
                  ? prev.currentQuestionStartTime
                  : updatedGame.currentQuestionStartTime,
            }));

            setLoading(false);
          },
        },
        {
          event: "question-finished",
          callback: (data: { currentQuestionIndex: number }) => {

            setGame((prev) =>
              prev
                ? {
                    ...prev,
                    currentQuestionStartTime:
                      Date.now() - (prev.questionTimeLimit || FALLBACK_QUESTION_TIME_LIMIT_MS),
                  }
                : prev
            );
          },
        },
        {
          event: "game-finished",
          callback: (data: { game: Game; results: GameResults | null }) => {

            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) => (prev ? { ...prev, status: GAME_STATUS.FINISHED } : prev));
            }
            if (data.results) {
              setResults(data.results);
            }
            setLoading(false);
          },
        },
        {
          event: "game-cancelled",
          callback: (data: { game: Game }) => {

            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) =>
                prev ? { ...prev, status: GAME_STATUS.CANCELLED } : prev
              );
            }
            setLoading(false);
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

            const { game: incomingGame, currentQuestionIndex, timeLeft } = data;
            setGame({
              ...incomingGame,
              currentQuestionIndex,
              currentQuestionStartTime:
                Date.now() - ((incomingGame.questionTimeLimit || FALLBACK_QUESTION_TIME_LIMIT_MS) - timeLeft),
            });
            setLoading(false);
          },
        },
      ],
      []
    ),
  });

  // Primer request al conectar (y en cada reconexión).
  useEffect(() => {
    if (!connected) return;

    gameSession.requestGameState(gameId);
  }, [gameSession, connected, gameId]);

  // Retry + fallback: el bucle vive en la facade; el hook lo cancela cuando llega estado.
  useEffect(() => {
    if (!loading) return;

    return gameSession.scheduleGameStateRetry(gameId, {
      onExhausted: () => {
        if (fallbackRequested.current) return; // EXACTAMENTE UNA VEZ (caracterizado)
        fallbackRequested.current = true;
        void gameSession.fetchGameState(gameId).then((httpGame) => {
          if (httpGame) {
            setGame(httpGame);
            setLoading(false);
          }
        });
      },
    });
  }, [gameSession, gameId, loading]);

  return { game, setGame, emit, loading, results };
};
