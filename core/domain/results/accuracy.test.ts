/**
 * Tests de `calculateAccuracyFromResults` (US-14, paridad con Results.tsx).
 *
 * Los valores espejo ("17", "67", "0") provienen de los tests de
 * caracterización `components/Results.test.tsx`.
 */
import { describe, expect, it } from "vitest";
import type { GameResults } from "./results-calculator";
import { calculateAccuracyFromResults } from "./accuracy";

type LeaderboardEntry = GameResults["leaderboard"][number];

const entry = (
  overrides: Partial<LeaderboardEntry> = {}
): LeaderboardEntry => ({
  playerId: "p1",
  name: "Ana",
  score: 100,
  correctAnswers: 1,
  totalQuestions: 3,
  percentage: 33.333,
  ...overrides,
});

const makeResults = (
  overrides: Partial<
    Pick<GameResults, "totalPlayers" | "totalQuestions" | "leaderboard">
  > = {}
): Pick<GameResults, "totalPlayers" | "totalQuestions" | "leaderboard"> => ({
  totalPlayers: 2,
  totalQuestions: 3,
  leaderboard: [entry(), entry({ playerId: "p2", correctAnswers: 0 })],
  ...overrides,
});

describe("calculateAccuracyFromResults — accuracy formateada legacy", () => {
  it("1 de 6 ⇒ '17' (toFixed(0) de 16.666)", () => {
    expect(
      calculateAccuracyFromResults(
        makeResults({
          totalPlayers: 2,
          totalQuestions: 3,
          leaderboard: [entry({ correctAnswers: 1 }), entry({ playerId: "p2", correctAnswers: 0 })],
        })
      )
    ).toBe("17");
  });

  it("2 de 3 ⇒ '67' (toFixed(0) de 66.666)", () => {
    expect(
      calculateAccuracyFromResults(
        makeResults({
          totalPlayers: 1,
          totalQuestions: 3,
          leaderboard: [entry({ correctAnswers: 2 })],
        })
      )
    ).toBe("67");
  });

  it("0 jugadores ⇒ '0' aunque el leaderboard no esté vacío", () => {
    expect(
      calculateAccuracyFromResults(
        makeResults({ totalPlayers: 0, leaderboard: [entry()] })
      )
    ).toBe("0");
  });

  it("totalPlayers > 0 con leaderboard vacío ⇒ '0'", () => {
    expect(
      calculateAccuracyFromResults(
        makeResults({ totalPlayers: 2, totalQuestions: 3, leaderboard: [] })
      )
    ).toBe("0");
  });

  it("todos correctos ⇒ '100'", () => {
    expect(
      calculateAccuracyFromResults(
        makeResults({
          totalPlayers: 1,
          totalQuestions: 3,
          leaderboard: [entry({ correctAnswers: 3 })],
        })
      )
    ).toBe("100");
  });

  it("trunca decimales con toFixed(0): 5 de 6 ⇒ '83'", () => {
    expect(
      calculateAccuracyFromResults(
        makeResults({
          totalPlayers: 6,
          totalQuestions: 1,
          leaderboard: [entry({ correctAnswers: 5 })],
        })
      )
    ).toBe("83");
  });
});
