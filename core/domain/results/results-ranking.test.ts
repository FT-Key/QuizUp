/**
 * Test ROJO pre-fix de US-20 (H2) — `leaderboard` sin ordenar.
 *
 * Reproduce el reporte real de una partida de 2 jugadores: el de 0 pts quedó 1°
 * y el de 2336 pts 2°, porque el `leaderboard` conserva el orden de
 * `game.players` y nunca se ordena.
 *
 * Contra el código actual (sin sort) este archivo FALLA a propósito; la
 * implementación de US-20 (orden por `score` descendente) debe ponerlo verde.
 * No usa campos nuevos: solo `Player`/`Game` vigentes.
 */
import { describe, expect, it } from "vitest";
import {
  ResultsBuilder,
  questionFixture,
} from "@/tests/builders/results-builder";
import { calculateResults } from "./results-calculator";

describe("calculateResults — ranking (US-20, rojo pre-fix)", () => {
  it("2 jugadores [0, 2336] en orden de inserción ⇒ leaderboard [2336, 0] (score desc)", () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withQuestions(questionFixture("q1", 0))
      .withPlayers(
        { id: "p-franco", name: "Franco", answers: {}, score: 0 },
        {
          id: "p-mel",
          name: "Mel",
          answers: { q1: 0 },
          score: 2336,
        }
      )
      .build();

    const leaderboard = calculateResults(game).leaderboard;

    expect(leaderboard.map((entry) => entry.name)).toEqual(["Mel", "Franco"]);
    expect(leaderboard.map((entry) => entry.score)).toEqual([2336, 0]);
  });
});
