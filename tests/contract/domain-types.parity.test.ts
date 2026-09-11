/**
 * Paridad de tipos legacy ↔ dominio (US-10).
 *
 * La deuda strangler mantiene dos familias de tipos estructuralmente idénticas
 * (`types/index.ts` y `core/domain/**`). Este test fija la asignabilidad mutua
 * en tiempo de compilación: si los tipos divergen, el gate `typecheck` falla.
 * La aserción runtime es trivial a propósito (el valor está en los tipos).
 *
 * `GameResults` se añade con `results-calculator` (§3.6 del design), de quien
 * depende su tipo. Los campos `questionResults?`/`averageScore?` se mantienen
 * opcionales para preservar la asignabilidad legacy → dominio.
 */
import { describe, expect, it } from "vitest";
import type {
  Game as LegacyGame,
  GameResults as LegacyGameResults,
  Player as LegacyPlayer,
  Question as LegacyQuestion,
} from "@/types";
import type { Game } from "@/core/domain/game";
import type { Player } from "@/core/domain/player";
import type { Question } from "@/core/domain/question";
import type { GameResults } from "@/core/domain/results/results-calculator";
import { calculateResults } from "@/core/domain/results/results-calculator";
import { ResultsBuilder, questionFixture } from "@/tests/builders/results-builder";

const legacyQuestion: LegacyQuestion = {
  id: "q-1",
  text: "Pregunta legacy",
  options: ["A", "B", "C", "D"],
  correctAnswer: 0,
  image: null,
};

const legacyPlayer: LegacyPlayer = {
  id: "p-1",
  name: "Jugador legacy",
  gameId: "g-1",
  answers: {},
  score: 0,
  joinedAt: new Date(0),
};

const legacyGame: LegacyGame = {
  id: "g-1",
  name: "Partida legacy",
  questions: [legacyQuestion],
  createdAt: new Date(0),
  creatorId: "c-1",
  status: "waiting",
  currentQuestionIndex: 0,
  players: [legacyPlayer],
  currentQuestionStartTime: 0,
  questionTimeLimit: 20000,
};

const legacyResults: LegacyGameResults = {
  gameId: "g-1",
  createdAt: new Date(0),
  totalPlayers: 1,
  totalQuestions: 1,
  leaderboard: [
    {
      playerId: "p-1",
      name: "Jugador legacy",
      score: 0,
      correctAnswers: 0,
      totalQuestions: 1,
      percentage: 0,
      avatar: undefined,
    },
  ],
};

// Compile-time: legacy -> dominio.
const questionFromLegacy: Question = legacyQuestion;
const playerFromLegacy: Player = legacyPlayer;
const gameFromLegacy: Game = legacyGame;
const resultsFromLegacy: GameResults = legacyResults;

// Compile-time: dominio -> legacy.
const domainQuestion = questionFixture("q-1", 0);
const domainGame = new ResultsBuilder()
  .withId("g-1")
  .withStatus("waiting")
  .withQuestions(domainQuestion)
  .withPlayer({ id: "p-1", name: "Jugador legacy" })
  .build();
const domainPlayer = domainGame.players[0];
const domainResults: GameResults = calculateResults(domainGame);
const questionToLegacy: LegacyQuestion = domainQuestion;
const playerToLegacy: LegacyPlayer = domainPlayer;
const gameToLegacy: LegacyGame = domainGame;
const resultsToLegacy: LegacyGameResults = domainResults;

describe("paridad estructural legacy ↔ dominio (compile-time)", () => {
  it("las entidades del dominio son asignables en ambos sentidos con el legado", () => {
    expect(questionFromLegacy.id).toBe(questionToLegacy.id);
    expect(playerFromLegacy.id).toBe(playerToLegacy.id);
    expect(gameFromLegacy.id).toBe(gameToLegacy.id);
    expect(resultsFromLegacy.gameId).toBe(resultsToLegacy.gameId);
    expect(domainResults.leaderboard).toHaveLength(1);
  });
});
