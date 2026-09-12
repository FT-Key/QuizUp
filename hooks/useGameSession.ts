"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import { usePlayerSession } from "@/hooks/usePlayerSession";
import {
  resolveGamePhase,
  type PlayerAnswerResult,
} from "@/core/domain/game/phase-resolver";
import type { Game, GameResults, Player, Question } from "@/types";

/** Fase de UI. `showing-scoreboard` la setea SOLO el timer de 4 s (nunca el resolver). */
export type GamePhase = "waiting" | "question" | "showing-result" | "showing-scoreboard";

export interface PreviousLeaderboardEntry {
  playerId: string;
  score: number;
}

export interface GameSessionAvatar {
  seed: string;
  accessories: string[];
}

export interface JoinGamePayload {
  playerName: string;
  avatarSeed?: string;
  avatarAccessories?: string[];
}

export interface GameSessionActions {
  /** Escribe sesión (nombre/seed/accesorios SIN filtrar) y emite `join-game` filtrado. */
  join(payload: JoinGamePayload): void;
  /** Emite `submit-answer` exacto + update optimista de `player`/`hasSubmitted`/`playerAnswerResult`. */
  submitAnswer(answerIndex: number): void;
}

export interface UseGameSessionResult {
  game: Game | null;
  player: Player | null;
  loading: boolean;
  error: string;
  phase: GamePhase;
  hasSubmitted: boolean;
  isQuestionFinished: boolean;
  playerAnswerResult: PlayerAnswerResult | null;
  previousLeaderboard: PreviousLeaderboardEntry[];
  results: GameResults | null;
  avatar: GameSessionAvatar;
  actions: GameSessionActions;
}

/**
 * Facade del estado del jugador (US-14): 12 estados, fetch inicial, 9 eventos
 * del socket, timer de 4 s y acciones `join`/`submitAnswer`. La página solo
 * consume `{ game, player, phase, actions }` (patrón vigente desde US-13).
 */
export function useGameSession(gameId: string): UseGameSessionResult {
  const session = usePlayerSession();

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState<GameResults | null>(null);
  const [isQuestionFinished, setIsQuestionFinished] = useState(false);
  const [playerAnswerResult, setPlayerAnswerResult] =
    useState<PlayerAnswerResult | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>("waiting");
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
    if (gamePhase === "showing-result") {
      const timer = setTimeout(() => {
        setGamePhase("showing-scoreboard");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [gamePhase]);

  const emitRef = useRef<((event: string, data?: unknown) => void) | null>(null);

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
              setPlayer(data.player);
              if (data.player.avatar?.seed) {
                setPlayerAvatarSeed(data.player.avatar.seed);
              }
              if (data.player.avatar?.accessories) {
                setPlayerAccessories(data.player.avatar.accessories);
              }
            }
            if (data.game) {
              setGame(data.game);
              const curQ = data.game.questions[data.game.currentQuestionIndex];
              if (data.player && curQ) {
                setHasSubmitted(
                  Boolean(
                    data.player.answers &&
                      data.player.answers[curQ.id] !== undefined
                  )
                );
              }
              syncPhaseFromGame(data.game, data.player);
            }
            setLoading(false);
          },
        },
        {
          event: "game-started",
          callback: (data: {
            game: Game;
            players: Player[];
            currentQuestion: Question;
          }) => {
            setIsQuestionFinished(false);
            setHasSubmitted(false);
            setPlayerAnswerResult(null);
            setGame(data.game);
            setGamePhase("question");

            const lb = data.game.players.map((p) => ({
              playerId: p.id,
              score: p.score,
            }));
            setPreviousLeaderboard(lb);

            const pid = session.get("playerId");
            if (pid) {
              const found = data.game.players.find((p) => p.id === pid);
              if (found) setPlayer(found);
            }
          },
        },
        {
          event: "game-updated",
          callback: (payload: { game: Game }) => {
            const updatedGame = payload.game;
            setGame(updatedGame);

            const pid = session.get("playerId");
            if (pid) {
              const found = updatedGame.players.find((p) => p.id === pid);
              if (found) {
                setPlayer(found);
                const curQ =
                  updatedGame.questions[updatedGame.currentQuestionIndex];
                if (curQ) {
                  const hasAnswer =
                    found.answers && found.answers[curQ.id] !== undefined;

                  setHasSubmitted(Boolean(hasAnswer));
                }
              }
            }

            const curQ = updatedGame.questions[updatedGame.currentQuestionIndex];
            if (curQ) {
              const allAnswered = updatedGame.players.every(
                (p) => p.answers?.[curQ.id] !== undefined
              );

              setIsQuestionFinished(allAnswered);
              if (allAnswered) {
                const pid2 = session.get("playerId");
                if (pid2) {
                  const me = updatedGame.players.find((p) => p.id === pid2);
                  if (me) {
                    const playerAns = me.answers?.[curQ.id];

                    if (playerAns !== undefined) {
                      setPlayerAnswerResult({
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
            setIsQuestionFinished(true);
            setGamePhase("showing-result");
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
            setGame(payload.game);
            const pid = session.get("playerId");
            if (pid) {
              const found = payload.game.players.find((p) => p.id === pid);
              if (found) {
                setPlayer(found);
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
          event: "game-cancelled",
          callback: (data: { game: Game }) => {
            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) =>
                prev ? { ...prev, status: "cancelled" } : prev
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
            setIsQuestionFinished(false);
            setHasSubmitted(false);
            setPlayerAnswerResult(null);
            setGamePhase("question");
            setGame((prev) => {
              if (!prev) return prev;
              return { ...prev, currentQuestionIndex: data.questionIndex };
            });
          },
        },
      ],
      [gameId, session, syncPhaseFromGame]
    ),
  });

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        if (!res.ok) throw new Error("Game not found");
        const data = (await res.json()) as { game: Game };
        setGame(data.game);

        const playerId = session.get("playerId");
        const playerName = session.get("playerName");
        const avatarSeed = session.get("playerAvatarSeed");
        if (avatarSeed) setPlayerAvatarSeed(avatarSeed);
        setPlayerAccessories(session.getAccessories());

        if (playerId && playerName) {
          const foundPlayer = data.game.players.find((p) => p.id === playerId);
          if (foundPlayer) {
            if (!foundPlayer.answers) foundPlayer.answers = {};
            setPlayer(foundPlayer);
            emitRef.current?.("join-game", {
              gameId,
              playerId,
              avatar: {
                seed: avatarSeed || playerName,
                accessories: session
                  .getAccessories()
                  .filter((a) => a !== "none"),
              },
            });

            const currentQuestion =
              data.game.questions[data.game.currentQuestionIndex];
            if (currentQuestion) {
              setHasSubmitted(
                foundPlayer.answers?.[currentQuestion.id] !== undefined
              );
            }
            syncPhaseFromGame(data.game, foundPlayer);
          }
        }
      } catch {
        setError("Failed to load game");
      } finally {
        setLoading(false);
      }
    };

    if (gameId) fetchGame();
  }, [gameId, session, syncPhaseFromGame]);

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
        seed: avatarSeed || trimmed,
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

    setPlayer((prev) =>
      prev
        ? {
            ...prev,
            answers: { ...prev.answers, [currentQuestion.id]: answerIndex },
          }
        : prev
    );
    setHasSubmitted(true);
    setPlayerAnswerResult({
      correct: answerIndex === currentQuestion.correctAnswer,
      score: player.score || 0,
    });
  };

  return {
    game,
    player,
    loading,
    error,
    phase: gamePhase,
    hasSubmitted,
    isQuestionFinished,
    playerAnswerResult,
    previousLeaderboard,
    results,
    avatar: {
      seed: playerAvatarSeed || player?.name || "",
      accessories: playerAccessories,
    },
    actions: { join, submitAnswer },
  };
}
