/**
 * CARACTERIZACIÓN US-14 — `Results` (accuracy inline).
 *
 * Congela el cálculo actual de accuracy (`toFixed(0)` sobre
 * correctAnswers / (totalPlayers * totalQuestions) * 100) ANTES de que US-14
 * lo reemplace por la lógica de `core/domain/results`.
 *
 * `Podium` se mockea (llama a `onComplete` tras 100 ms) para llegar a
 * `showStats` con fake timers y sin animaciones/aleatoriedad. No hay red real.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameResults } from "@/types";
import { Results } from "./Results";

vi.mock("./Podium", async () => {
  const { useEffect } = await import("react");
  return {
    Podium: ({
      topThree,
      onComplete,
    }: {
      topThree: unknown[];
      onComplete?: () => void;
    }) => {
      useEffect(() => {
        const timer = setTimeout(() => onComplete?.(), 100);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="podium-mock">{topThree.length}</div>;
    },
  };
});

type FetchFunction = (input: string) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFunction>>;

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response;

const makeLeaderboardEntry = (
  overrides: Partial<GameResults["leaderboard"][number]> = {}
): GameResults["leaderboard"][number] => ({
  playerId: "p1",
  name: "Ana",
  score: 100,
  correctAnswers: 1,
  totalQuestions: 3,
  percentage: 33.333,
  ...overrides,
});

const makeResults = (overrides: Partial<GameResults> = {}): GameResults => ({
  gameId: "g1",
  createdAt: new Date(0),
  totalPlayers: 2,
  totalQuestions: 3,
  leaderboard: [
    makeLeaderboardEntry({ playerId: "p1", name: "Ana", correctAnswers: 1 }),
    makeLeaderboardEntry({
      playerId: "p2",
      name: "Beto",
      score: 0,
      correctAnswers: 0,
      percentage: 0,
    }),
  ],
  ...overrides,
});

/**
 * Llega a `showStats` con `Podium` mockeado: 100 ms de podium + 5000 ms de
 * espera. Los fake timers se activan justo antes del render porque `waitFor`
 * (RTL) no avanza timers falsos en Vitest.
 */
const renderAndRevealStats = async (results: GameResults) => {
  vi.useFakeTimers();
  render(<Results gameId="g1" results={results} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
};

beforeEach(() => {
  fetchMock = vi.fn<FetchFunction>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Results (caracterización US-14)", () => {
  it("sin prop results muestra 'Loading results...' mientras el fetch está pendiente", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    render(<Results gameId="g1" />);

    expect(screen.getByText("Loading results...")).toBeTruthy();
  });

  it("fetch ok con results null muestra 'No results available' y pega a /api/games/g1/results", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: null }));

    render(<Results gameId="g1" />);

    await waitFor(() =>
      expect(screen.getByText("No results available")).toBeTruthy()
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/games/g1/results");
  });

  it("sin prop results usa el resultado del fetch y calcula accuracy 0% con leaderboard vacío", async () => {
    const fetched = makeResults({
      totalPlayers: 2,
      totalQuestions: 3,
      leaderboard: [],
    });
    fetchMock.mockResolvedValue(jsonResponse({ results: fetched }));

    render(<Results gameId="g1" />);

    // Sin podio, stats se muestran al instante.
    await waitFor(() => expect(screen.getByText("Resultados Finales")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/games/g1/results");
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("Leaderboard")).toBeTruthy();
  });

  it("CARACTERIZACIÓN: accuracy 1 de 6 se muestra como 17% (toFixed(0) de 16.666)", async () => {
    // 1 acierto / (2 jugadores * 3 preguntas) = 16.666... → "17%".
    await renderAndRevealStats(
      makeResults({
        totalPlayers: 2,
        totalQuestions: 3,
        leaderboard: [
          makeLeaderboardEntry({ playerId: "p1", correctAnswers: 1 }),
          makeLeaderboardEntry({
            playerId: "p2",
            name: "Beto",
            score: 0,
            correctAnswers: 0,
            percentage: 0,
          }),
        ],
      })
    );

    expect(screen.getByText("Resultados Finales")).toBeTruthy();
    expect(screen.getByText("17%")).toBeTruthy();
    // Contadores de presentación: Players y Correct.
    expect(screen.getByText("Players")).toBeTruthy();
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("Accuracy")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("1/3 correct")).toBeTruthy();
  });

  it("CARACTERIZACIÓN: accuracy 2 de 3 se muestra como 67% (toFixed(0) de 66.666)", async () => {
    await renderAndRevealStats(
      makeResults({
        totalPlayers: 1,
        totalQuestions: 3,
        leaderboard: [
          makeLeaderboardEntry({
            playerId: "p1",
            correctAnswers: 2,
            totalQuestions: 3,
          }),
        ],
      })
    );

    expect(screen.getByText("67%")).toBeTruthy();
  });

  it("CARACTERIZACIÓN: 0 jugadores muestra accuracy 0%", async () => {
    // hasPodium === false ⇒ showStats inmediato, sin timers.
    render(
      <Results
        gameId="g1"
        results={makeResults({ totalPlayers: 0, leaderboard: [] })}
      />
    );

    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("marca 'All Correct' cuando correctAnswers === totalQuestions y muestra los puntos", async () => {
    await renderAndRevealStats(
      makeResults({
        totalPlayers: 1,
        totalQuestions: 3,
        leaderboard: [
          makeLeaderboardEntry({
            playerId: "p1",
            name: "Ana",
            score: 350,
            correctAnswers: 3,
            totalQuestions: 3,
            percentage: 100,
          }),
        ],
      })
    );

    expect(screen.getByText("All Correct")).toBeTruthy();
    expect(screen.getByText("350")).toBeTruthy();
    expect(screen.getByText("pts")).toBeTruthy();
  });
});
