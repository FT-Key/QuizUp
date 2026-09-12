import type { Dispatch, SetStateAction } from "react";
import type { PlayerAnswerResult } from "@/core/domain/game/phase-resolver";
import type { Game, GameResults, Player } from "@/types";

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

/** Los 12 estados del hook, agrupados para la composición del facade. */
export interface GameSessionState {
  game: Game | null;
  player: Player | null;
  loading: boolean;
  error: string;
  hasSubmitted: boolean;
  results: GameResults | null;
  isQuestionFinished: boolean;
  playerAnswerResult: PlayerAnswerResult | null;
  gamePhase: GamePhase;
  playerAvatarSeed: string;
  playerAccessories: string[];
  previousLeaderboard: PreviousLeaderboardEntry[];
}

/** Setters estables de `useState`, agrupados en un objeto memoizado. */
export interface GameSessionSetters {
  setGame: Dispatch<SetStateAction<Game | null>>;
  setPlayer: Dispatch<SetStateAction<Player | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setHasSubmitted: Dispatch<SetStateAction<boolean>>;
  setResults: Dispatch<SetStateAction<GameResults | null>>;
  setIsQuestionFinished: Dispatch<SetStateAction<boolean>>;
  setPlayerAnswerResult: Dispatch<SetStateAction<PlayerAnswerResult | null>>;
  setGamePhase: Dispatch<SetStateAction<GamePhase>>;
  setPlayerAvatarSeed: Dispatch<SetStateAction<string>>;
  setPlayerAccessories: Dispatch<SetStateAction<string[]>>;
  setPreviousLeaderboard: Dispatch<SetStateAction<PreviousLeaderboardEntry[]>>;
}
