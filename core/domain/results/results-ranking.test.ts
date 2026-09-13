/**
 * Tests de ranking del leaderboard (US-20, H2).
 *
 * Congelan la regla de orden D-H2.2/D-H2.3:
 * `score` desc → `totalTimeMs` asc (undefined al final) → `joinedAt` asc →
 * `playerId` asc, más el fallback legacy sin `answerTimesMs` y la tabla de
 * `totalTimeMsOf`/`compareRanking`. El caso del reporte real (0 pts insertado
 * primero) queda verde con el sort implementado en el paso 5 de US-20.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import {
  ResultsBuilder,
  questionFixture,
  type ResultsPlayerFixture,
} from "@/tests/builders/results-builder";
import {
  calculateResults,
  compareRanking,
  totalTimeMsOf,
  type RankingInput,
} from "./results-calculator";

const GAME_ID = "123456";
const BASE_TIME = 1_700_000_000_000;
const LIMIT = DEFAULT_TIME_LIMIT_MS;

/** Partida de 2 preguntas con `questionTimeLimit` default (20000). */
function twoQuestionGame(...players: ResultsPlayerFixture[]) {
  return new ResultsBuilder()
    .withId(GAME_ID)
    .withQuestions(questionFixture("q-1", 1), questionFixture("q-2", 2))
    .withPlayers(...players)
    .build();
}

/** Fixture de jugador de ranking; sin `answerTimesMs` ⇒ legacy (clave ausente). */
function playerFixture(spec: {
  id: string;
  name: string;
  score: number;
  answerTimesMs?: Record<string, number>;
  joinedAt?: Date;
}): ResultsPlayerFixture {
  return {
    id: spec.id,
    name: spec.name,
    score: spec.score,
    joinedAt: spec.joinedAt ?? new Date(BASE_TIME),
    ...(spec.answerTimesMs !== undefined
      ? { answerTimesMs: spec.answerTimesMs }
      : {}),
  };
}

describe("calculateResults — ranking (US-20)", () => {
  it("reporte real: 0 pts insertado primero y 2336 pts después ⇒ leaderboard [2336, 0]", () => {
    const game = twoQuestionGame(
      { id: "p-franco", name: "Franco", answers: {}, score: 0 },
      { id: "p-mel", name: "Mel", answers: { "q-1": 1 }, score: 2336 }
    );

    const leaderboard = calculateResults(game).leaderboard;

    expect(leaderboard.map((entry) => entry.name)).toEqual(["Mel", "Franco"]);
    expect(leaderboard.map((entry) => entry.score)).toEqual([2336, 0]);
  });

  it("empate en score: gana menor totalTimeMs aunque esté insertado después", () => {
    const game = twoQuestionGame(
      playerFixture({
        id: "p-slow",
        name: "Slow",
        score: 100,
        answerTimesMs: { "q-1": 3000, "q-2": 4000 },
      }),
      playerFixture({
        id: "p-fast",
        name: "Fast",
        score: 100,
        answerTimesMs: { "q-1": 1000, "q-2": 2000 },
      })
    );

    const leaderboard = calculateResults(game).leaderboard;

    expect(leaderboard.map((entry) => entry.name)).toEqual(["Fast", "Slow"]);
    expect(leaderboard.map((entry) => entry.totalTimeMs)).toEqual([3000, 7000]);
  });

  it("empate en score con un legacy sin dato: gana el que tiene totalTimeMs (undefined va al final)", () => {
    const game = twoQuestionGame(
      playerFixture({ id: "p-legacy", name: "Legacy", score: 100 }),
      playerFixture({
        id: "p-timed",
        name: "Timed",
        score: 100,
        answerTimesMs: { "q-1": 19_000, "q-2": 100 },
      })
    );

    const leaderboard = calculateResults(game).leaderboard;

    expect(leaderboard.map((entry) => entry.name)).toEqual(["Timed", "Legacy"]);
    expect("totalTimeMs" in leaderboard[0]).toBe(true);
    expect("totalTimeMs" in leaderboard[1]).toBe(false);
  });

  it("empate total legacy: joinedAt ascendente decide", () => {
    const game = twoQuestionGame(
      playerFixture({
        id: "p-late",
        name: "Late",
        score: 50,
        joinedAt: new Date(BASE_TIME + 5000),
      }),
      playerFixture({
        id: "p-early",
        name: "Early",
        score: 50,
        joinedAt: new Date(BASE_TIME),
      })
    );

    const leaderboard = calculateResults(game).leaderboard;

    expect(leaderboard.map((entry) => entry.name)).toEqual(["Early", "Late"]);
  });

  it("empate en score, tiempo y joinedAt: playerId ascendente decide (orden total)", () => {
    const joinedAt = new Date(BASE_TIME);
    const game = twoQuestionGame(
      playerFixture({ id: "p-b", name: "Beto", score: 50, joinedAt }),
      playerFixture({ id: "p-a", name: "Ana", score: 50, joinedAt })
    );

    const leaderboard = calculateResults(game).leaderboard;

    expect(leaderboard.map((entry) => entry.playerId)).toEqual(["p-a", "p-b"]);
  });

  it("questionResults NO se ordena: conserva el orden preguntas × jugadores", () => {
    const game = twoQuestionGame(
      {
        id: "p-low",
        name: "Low",
        answers: { "q-1": 0 },
        score: 0,
      },
      {
        id: "p-high",
        name: "High",
        answers: { "q-1": 1 },
        score: 2001,
      }
    );

    const results = calculateResults(game);

    expect(results.leaderboard.map((entry) => entry.name)).toEqual([
      "High",
      "Low",
    ]);
    expect(
      results.questionResults?.[0].playerAnswers.map((a) => a.playerId)
    ).toEqual(["p-low", "p-high"]);
    expect(
      results.questionResults?.[1].playerAnswers.map((a) => a.playerId)
    ).toEqual(["p-low", "p-high"]);
  });
});

describe("totalTimeMsOf (US-20)", () => {
  const game = twoQuestionGame();

  it("suma los tiempos de las preguntas respondidas", () => {
    const player = twoQuestionGame(
      playerFixture({
        id: "p-1",
        name: "Ana",
        score: 0,
        answerTimesMs: { "q-1": 500, "q-2": 1500 },
      })
    ).players[0];

    expect(totalTimeMsOf(player, game)).toBe(2000);
  });

  it("pregunta sin entrada cuenta el límite completo", () => {
    const player = twoQuestionGame(
      playerFixture({
        id: "p-1",
        name: "Ana",
        score: 0,
        answerTimesMs: { "q-1": 500 },
      })
    ).players[0];

    expect(totalTimeMsOf(player, game)).toBe(500 + LIMIT);
  });

  it("entrada corrupta (NaN o negativa) cuenta el límite completo", () => {
    const player = twoQuestionGame(
      playerFixture({
        id: "p-1",
        name: "Ana",
        score: 0,
        answerTimesMs: { "q-1": Number.NaN, "q-2": -1 },
      })
    ).players[0];

    expect(totalTimeMsOf(player, game)).toBe(LIMIT * 2);
  });

  it("valor mayor al límite se clampea a questionTimeLimit", () => {
    const player = twoQuestionGame(
      playerFixture({
        id: "p-1",
        name: "Ana",
        score: 0,
        answerTimesMs: { "q-1": 99_999, "q-2": 1500 },
      })
    ).players[0];

    expect(totalTimeMsOf(player, game)).toBe(LIMIT + 1500);
  });

  it("0 es válido (respuesta instantánea)", () => {
    const player = twoQuestionGame(
      playerFixture({
        id: "p-1",
        name: "Ana",
        score: 0,
        answerTimesMs: { "q-1": 0, "q-2": 0 },
      })
    ).players[0];

    expect(totalTimeMsOf(player, game)).toBe(0);
  });

  it("sin answerTimesMs (legacy) devuelve undefined", () => {
    const player = twoQuestionGame(
      playerFixture({ id: "p-1", name: "Ana", score: 0 })
    ).players[0];

    expect(totalTimeMsOf(player, game)).toBeUndefined();
  });

  it("mapa vacío ⇒ Σ de límites (partida nueva sin responder)", () => {
    const player = twoQuestionGame(
      playerFixture({ id: "p-1", name: "Ana", score: 0, answerTimesMs: {} })
    ).players[0];

    expect(totalTimeMsOf(player, game)).toBe(LIMIT * 2);
  });
});

describe("compareRanking (US-20)", () => {
  const rank = (overrides: Partial<RankingInput> = {}): RankingInput => ({
    playerId: "p-1",
    score: 100,
    totalTimeMs: 1000,
    joinedAt: new Date(BASE_TIME),
    ...overrides,
  });

  it("score desc manda sobre cualquier desempate", () => {
    expect(
      compareRanking(
        rank({ score: 101, totalTimeMs: 9999 }),
        rank({ score: 100, totalTimeMs: 1 })
      )
    ).toBeLessThan(0);
    expect(
      compareRanking(
        rank({ score: 99, totalTimeMs: 1 }),
        rank({ score: 100, totalTimeMs: 9999 })
      )
    ).toBeGreaterThan(0);
  });

  it("empate en score: menor totalTimeMs gana; undefined pierde contra cualquier dato", () => {
    expect(
      compareRanking(rank({ totalTimeMs: 1000 }), rank({ totalTimeMs: 2000 }))
    ).toBeLessThan(0);
    expect(
      compareRanking(rank({ totalTimeMs: undefined }), rank({ totalTimeMs: 2000 }))
    ).toBeGreaterThan(0);
    expect(
      compareRanking(rank({ totalTimeMs: 2000 }), rank({ totalTimeMs: undefined }))
    ).toBeLessThan(0);
  });

  it("empate en score y tiempo: joinedAt ascendente", () => {
    expect(
      compareRanking(
        rank({ joinedAt: new Date(BASE_TIME) }),
        rank({ joinedAt: new Date(BASE_TIME + 1) })
      )
    ).toBeLessThan(0);
  });

  it("empate total: playerId ascendente y 0 solo contra sí mismo", () => {
    expect(
      compareRanking(rank({ playerId: "p-a" }), rank({ playerId: "p-b" }))
    ).toBeLessThan(0);
    expect(
      compareRanking(rank({ playerId: "p-b" }), rank({ playerId: "p-a" }))
    ).toBeGreaterThan(0);
    expect(compareRanking(rank(), rank())).toBe(0);
  });
});
