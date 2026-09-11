/**
 * Tests de `calculateResults` (US-10).
 *
 * El calculador es la única función canónica de resultados del repo. La
 * paridad con la ruta legacy se verifica en `tests/api/results-parity.test.ts`;
 * acá se cubren todas las ramas y bordes del §5.2-B del design note.
 */
import { describe, expect, it } from "vitest";
import { ResultsBuilder, questionFixture } from "@/tests/builders/results-builder";
import { calculateResults } from "./results-calculator";

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

describe("calculateResults — cálculo único de resultados (paridad ruta legacy)", () => {
  it("todos aciertan ⇒ percentage crudo 100 y score persistido (1500/900) intacto, no el conteo", () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 2), questionFixture("q2", 4))
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 2, q2: 4 }, score: 1500 },
        { id: "p2", name: "Beto", answers: { q1: 2, q2: 4 }, score: 900 }
      )
      .build();

    const results = calculateResults(game);

    expect(results.gameId).toBe("123456");
    expect(results.createdAt).toEqual(CREATED_AT);
    expect(results.leaderboard).toEqual([
      {
        playerId: "p1",
        name: "Ana",
        score: 1500, // puntaje persistido con bonus, no el conteo (2)
        correctAnswers: 2,
        totalQuestions: 2,
        percentage: 100,
        avatar: undefined,
      },
      {
        playerId: "p2",
        name: "Beto",
        score: 900,
        correctAnswers: 2,
        totalQuestions: 2,
        percentage: 100,
        avatar: undefined,
      },
    ]);
    expect(results.totalPlayers).toBe(2);
    expect(results.totalQuestions).toBe(2);
  });

  it("nadie acierta ⇒ correctAnswers 0, percentage 0, isCorrect false", () => {
    const game = new ResultsBuilder()
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 1))
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 9, q2: 9 }, score: 0 },
        { id: "p2", name: "Beto", answers: { q1: 9, q2: 9 }, score: 0 }
      )
      .build();

    const results = calculateResults(game);

    for (const entry of results.leaderboard) {
      expect(entry.correctAnswers).toBe(0);
      expect(entry.percentage).toBe(0);
    }
    for (const question of results.questionResults ?? []) {
      for (const answer of question.playerAnswers) {
        expect(answer.isCorrect).toBe(false);
      }
    }
  });

  it("respuestas parciales ⇒ correctAnswers solo de las contestadas correctamente", () => {
    const game = new ResultsBuilder()
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 3))
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 0 }, score: 750 },
        { id: "p2", name: "Beto", answers: {}, score: 0 }
      )
      .build();

    const [ana, beto] = calculateResults(game).leaderboard;

    expect(ana.correctAnswers).toBe(1);
    expect(ana.percentage).toBe(50);
    expect(beto.correctAnswers).toBe(0);
    expect(beto.percentage).toBe(0);
  });

  it("percentage crudo sin redondear: 1/3 ⇒ 33.33333333333333; 2/3 ⇒ 66.66666666666666", () => {
    const game = new ResultsBuilder()
      .withQuestions(
        questionFixture("q1", 0),
        questionFixture("q2", 1),
        questionFixture("q3", 2)
      )
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 0, q2: 9, q3: 9 }, score: 100 },
        { id: "p2", name: "Beto", answers: { q1: 0, q2: 1 }, score: 101 }
      )
      .build();

    const [ana, beto] = calculateResults(game).leaderboard;

    expect(ana.percentage).toBe(33.33333333333333);
    expect(ana.percentage).not.toBe(33);
    expect(beto.percentage).toBe(66.66666666666666);
    expect(beto.percentage).not.toBe(67);
  });

  it("leaderboard conserva el orden de players (no ordena por score)", () => {
    const game = new ResultsBuilder()
      .withQuestions(questionFixture("q1", 0))
      .withPlayers(
        { id: "p-zoe", name: "Zoe", answers: { q1: 0 }, score: 100 },
        { id: "p-ana", name: "Ana", answers: { q1: 0 }, score: 900 }
      )
      .build();

    const leaderboard = calculateResults(game).leaderboard;

    expect(leaderboard.map((entry) => entry.playerId)).toEqual([
      "p-zoe",
      "p-ana",
    ]);
    expect(leaderboard.map((entry) => entry.score)).toEqual([100, 900]);
  });

  it("avatar: la clave existe siempre; se propaga cuando está presente", () => {
    const avatar = { seed: "ana", accessories: ["glasses"] };
    const game = new ResultsBuilder()
      .withQuestions(questionFixture("q1", 0))
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 0 }, score: 100, avatar },
        { id: "p2", name: "Beto", answers: { q1: 0 }, score: 50 }
      )
      .build();

    const [ana, beto] = calculateResults(game).leaderboard;

    expect(ana.avatar).toEqual(avatar);
    expect(Object.keys(beto)).toContain("avatar");
    expect(beto.avatar).toBeUndefined();
  });

  it("sin jugadores ⇒ leaderboard [], totalPlayers 0, averageScore 0, playerAnswers []", () => {
    const game = new ResultsBuilder()
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 1))
      .build();

    const results = calculateResults(game);

    expect(results.totalPlayers).toBe(0);
    expect(results.leaderboard).toEqual([]);
    expect(results.averageScore).toBe(0);
    expect(results.questionResults).toHaveLength(2);
    for (const question of results.questionResults ?? []) {
      expect(question.playerAnswers).toEqual([]);
    }
  });

  it("sin preguntas ⇒ totalQuestions 0, percentage 0 sin dividir por cero, questionResults []", () => {
    const game = new ResultsBuilder()
      .withPlayers(
        { id: "p1", name: "Ana", answers: {}, score: 300 },
        { id: "p2", name: "Beto", answers: {}, score: 100 }
      )
      .build();

    const results = calculateResults(game);

    expect(results.totalQuestions).toBe(0);
    expect(results.questionResults).toEqual([]);
    for (const entry of results.leaderboard) {
      expect(entry.correctAnswers).toBe(0);
      expect(entry.percentage).toBe(0);
      expect(Number.isNaN(entry.percentage)).toBe(false);
    }
    expect(results.averageScore).toBe(200);
  });

  it("questionResults: sin responder ⇒ answer -1 e isCorrect false; incorrecta ⇒ answer real e isCorrect false", () => {
    const game = new ResultsBuilder()
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 3))
      .withPlayers(
        // Ana responde q1 bien y omite q2; Beto responde q1 mal y omite q2.
        { id: "p1", name: "Ana", answers: { q1: 0 }, score: 750 },
        { id: "p2", name: "Beto", answers: { q1: 9 }, score: 0 }
      )
      .build();

    const [q1, q2] = calculateResults(game).questionResults ?? [];

    expect(q1.playerAnswers).toEqual([
      { playerId: "p1", name: "Ana", answer: 0, isCorrect: true },
      { playerId: "p2", name: "Beto", answer: 9, isCorrect: false },
    ]);
    expect(q2.playerAnswers).toEqual([
      { playerId: "p1", name: "Ana", answer: -1, isCorrect: false },
      { playerId: "p2", name: "Beto", answer: -1, isCorrect: false },
    ]);
  });

  it("questionResults respeta orden preguntas × jugadores y copia questionText/correctAnswer", () => {
    const game = new ResultsBuilder()
      .withQuestions(
        questionFixture("q1", 2, "¿Cuál es la capital de Francia?"),
        questionFixture("q2", 4, "¿Cuánto es 2 + 2?")
      )
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 2, q2: 4 }, score: 100 },
        { id: "p2", name: "Beto", answers: { q1: 2, q2: 4 }, score: 100 }
      )
      .build();

    const questionResults = calculateResults(game).questionResults ?? [];

    expect(questionResults.map((q) => q.questionId)).toEqual(["q1", "q2"]);
    expect(questionResults.map((q) => q.questionText)).toEqual([
      "¿Cuál es la capital de Francia?",
      "¿Cuánto es 2 + 2?",
    ]);
    expect(questionResults.map((q) => q.correctAnswer)).toEqual([2, 4]);
    for (const question of questionResults) {
      expect(question.playerAnswers.map((p) => p.playerId)).toEqual([
        "p1",
        "p2",
      ]);
    }
  });

  it("averageScore sin redondear (100.5 con 2 jugadores)", () => {
    const game = new ResultsBuilder()
      .withPlayers(
        { id: "p1", name: "Ana", answers: {}, score: 100 },
        { id: "p2", name: "Beto", answers: {}, score: 101 }
      )
      .build();

    expect(calculateResults(game).averageScore).toBe(100.5);
  });

  it("respuestas a questionId desconocido no cuentan como aciertos", () => {
    const game = new ResultsBuilder()
      .withQuestions(questionFixture("q1", 0))
      .withPlayers({
        id: "p1",
        name: "Ana",
        answers: { q1: 0, "q-desconocida": 0 },
        score: 25,
      })
      .build();

    const results = calculateResults(game);

    expect(results.leaderboard[0].correctAnswers).toBe(1);
    expect(results.leaderboard[0].percentage).toBe(100);
    expect(results.questionResults).toHaveLength(1);
  });

  it("no muta el Game de entrada", () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 1))
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 0 }, score: 750 },
        { id: "p2", name: "Beto", answers: {}, score: 0 }
      )
      .build();
    const snapshot = structuredClone(game);

    calculateResults(game);

    expect(game).toEqual(snapshot);
  });
});
