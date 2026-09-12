import { FALLBACK_QUESTION_TIME_LIMIT_MS } from "@/constants/game";
import type { Game } from "../game";
import type { Player } from "../player";
import { GAME_STATUS, QUESTION_NOT_STARTED } from "./constants";

/** Fases resolubles desde el estado del servidor. `showing-scoreboard` es UI (timer de 4 s). */
export type ResolvableGamePhase = "question" | "showing-result";

export interface PlayerAnswerResult {
  correct: boolean;
  score: number;
}

export interface GamePhaseResolution {
  phase: ResolvableGamePhase;
  hasSubmitted: boolean;
  questionFinished: boolean;
  answerResult: PlayerAnswerResult | null;
}

/**
 * Única definición de las reglas de fase del jugador (paridad con `syncPhaseFromGame`):
 * - `status !== "active"` ⇒ null (el caller conserva su estado: early-return legacy).
 * - sin pregunta actual ⇒ null.
 * - `hasSubmitted`: `me.answers[q.id] !== undefined` (incluye `0`).
 * - `questionFinished`: `allAnswered` (con `players.length > 0`) o `timeExpired`
 *   (`start === 0` o `now >= start + (limit || 30000)`).
 * - `answerResult` solo si el jugador respondió: `{ correct, score: me.score || 0 }`.
 */
export function resolveGamePhase(
  game: Game,
  me: Player | null | undefined,
  now: number
): GamePhaseResolution | null {
  if (game.status !== GAME_STATUS.ACTIVE) return null;

  const question = game.questions[game.currentQuestionIndex];
  if (!question) return null;

  const hasSubmitted = me?.answers?.[question.id] !== undefined;
  const allAnswered =
    game.players.length > 0 &&
    game.players.every((p) => p.answers?.[question.id] !== undefined);
  const timeExpired =
    game.currentQuestionStartTime === QUESTION_NOT_STARTED ||
    (game.currentQuestionStartTime > QUESTION_NOT_STARTED &&
      now >= game.currentQuestionStartTime + (game.questionTimeLimit || FALLBACK_QUESTION_TIME_LIMIT_MS));
  const questionFinished = allAnswered || timeExpired;

  const answerResult =
    hasSubmitted && me
      ? {
          correct: me.answers[question.id] === question.correctAnswer,
          score: me.score || 0,
        }
      : null;

  return {
    phase: questionFinished ? "showing-result" : "question",
    hasSubmitted,
    questionFinished,
    answerResult,
  };
}
