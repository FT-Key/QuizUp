/**
 * Tests de `lib/results-display.ts` (US-20, D-H2.4): formato `X.Xs` y detección
 * del ganador del desempate para el badge de `Results.tsx`.
 */
import { describe, expect, it } from "vitest";
import {
  formatDurationSeconds,
  isFasterAnswersWinner,
} from "./results-display";

describe("formatDurationSeconds", () => {
  it("formatea con un decimal: 45200 -> 45.2s", () => {
    expect(formatDurationSeconds(45200)).toBe("45.2s");
  });

  it("0 -> 0.0s", () => {
    expect(formatDurationSeconds(0)).toBe("0.0s");
  });

  it("redondea al decimal más cercano: 45250 -> 45.3s", () => {
    expect(formatDurationSeconds(45250)).toBe("45.3s");
  });
});

describe("isFasterAnswersWinner", () => {
  it("empate en score con totalTimeMs: true en la primera entrada, false en la segunda", () => {
    const leaderboard = [
      { score: 100, totalTimeMs: 45200 },
      { score: 100, totalTimeMs: 60000 },
    ];

    expect(isFasterAnswersWinner(leaderboard, 0)).toBe(true);
    expect(isFasterAnswersWinner(leaderboard, 1)).toBe(false);
  });

  it("sin empate en score: false aunque haya totalTimeMs", () => {
    const leaderboard = [
      { score: 200, totalTimeMs: 3000 },
      { score: 100, totalTimeMs: 1000 },
    ];

    expect(isFasterAnswersWinner(leaderboard, 0)).toBe(false);
    expect(isFasterAnswersWinner(leaderboard, 1)).toBe(false);
  });

  it("empate sin totalTimeMs (legacy): false (no se inventan tiempos)", () => {
    const leaderboard = [{ score: 100 }, { score: 100 }];

    expect(isFasterAnswersWinner(leaderboard, 0)).toBe(false);
    expect(isFasterAnswersWinner(leaderboard, 1)).toBe(false);
  });

  it("3+ empatados: el badge es solo para quien encabeza el grupo", () => {
    const leaderboard = [
      { score: 100, totalTimeMs: 1000 },
      { score: 100, totalTimeMs: 2000 },
      { score: 100, totalTimeMs: 3000 },
    ];

    expect(isFasterAnswersWinner(leaderboard, 0)).toBe(true);
    expect(isFasterAnswersWinner(leaderboard, 1)).toBe(false);
    expect(isFasterAnswersWinner(leaderboard, 2)).toBe(false);
  });

  it("fuera de rango: false", () => {
    expect(isFasterAnswersWinner([{ score: 100, totalTimeMs: 1 }], 1)).toBe(false);
  });
});
