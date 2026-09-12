/**
 * CARACTERIZACIÓN US-14 — `app/game/[gameId]/admin/page.tsx`.
 *
 * Congela las acciones del admin actuales (start/next/forceEnd/finish/lock/
 * close/kick), la bifurcación por `status` y los updates optimistas, antes de
 * extraer `useAdminActions`.
 *
 * Mockea `@/hooks/useAdminSocket` (con `setGame` que soporta updater),
 * `@/hooks/useQuestionTimer`, `@/components/Results` y `AnswerChart`
 * (recharts necesita ResizeObserver, ausente en jsdom). `AdminLobby` y
 * `AdminPresentation` se renderizan reales.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Game, GameResults, Player, Question } from "@/types";
import AdminPage from "./page";

const GAME_ID = "123456";

const adminMock = vi.hoisted(() => ({
  emit: vi.fn(),
  initialGame: null as unknown,
  initialResults: null as unknown,
  initialLoading: false,
  setGameCalls: [] as unknown[],
  currentGame: null as unknown,
  currentResults: null as unknown,
}));

const timerMock = vi.hoisted(() => ({ timeLeft: 15000, isFinished: false }));
const resultsCapture = vi.hoisted(() => ({ props: null as unknown }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ gameId: "123456" }),
}));

vi.mock("@/hooks/useAdminSocket", async () => {
  const React = await import("react");
  return {
    useAdminSocket: () => {
      const [game, setGameState] = React.useState<Game | null>(
        adminMock.initialGame as Game | null
      );
      const [results] = React.useState<GameResults | null>(
        adminMock.initialResults as GameResults | null
      );
      adminMock.currentGame = game;
      adminMock.currentResults = results;
      const setGame = React.useCallback((updater: any) => {
        adminMock.setGameCalls.push(updater);
        setGameState((prev: Game | null) =>
          typeof updater === "function"
            ? (updater as (g: Game | null) => Game | null)(prev)
            : (updater as Game | null)
        );
      }, []);
      return {
        game,
        setGame,
        emit: adminMock.emit,
        loading: adminMock.initialLoading,
        results,
      };
    },
  };
});

vi.mock("@/hooks/useQuestionTimer", () => ({
  useQuestionTimer: () => ({
    timeLeft: timerMock.timeLeft,
    isFinished: timerMock.isFinished,
  }),
}));

vi.mock("@/components/Results", () => ({
  Results: (props: unknown) => {
    resultsCapture.props = props;
    return <div>results-mock</div>;
  },
}));

vi.mock("@/components/admin/AnswerChart", () => ({
  AnswerChart: () => <div>answer-chart-mock</div>,
}));

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFunction>>;
let alertSpy: ReturnType<typeof vi.spyOn>;

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response;

const makePlayer = (id: string, overrides: Partial<Player> = {}): Player => ({
  id,
  name: id === "p1" ? "Ana" : "Beto",
  gameId: GAME_ID,
  answers: {},
  score: 0,
  joinedAt: new Date(0),
  ...overrides,
});

const makeQuestion = (id: string): Question => ({
  id,
  text: `Pregunta ${id}`,
  options: ["A", "B", "C", "D"],
  correctAnswer: 0,
  image: null,
});

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: GAME_ID,
  name: "Trivia de prueba",
  questions: [makeQuestion("q1")],
  createdAt: new Date(0),
  creatorId: "admin",
  status: "waiting",
  currentQuestionIndex: 0,
  players: [makePlayer("p1"), makePlayer("p2")],
  currentQuestionStartTime: 0,
  questionTimeLimit: 30000,
  ...overrides,
});

beforeEach(() => {
  adminMock.emit.mockReset();
  adminMock.setGameCalls = [];
  adminMock.initialGame = null;
  adminMock.initialResults = null;
  adminMock.initialLoading = false;
  adminMock.currentGame = null;
  adminMock.currentResults = null;
  timerMock.timeLeft = 15000;
  timerMock.isFinished = false;
  resultsCapture.props = null;

  fetchMock = vi.fn<FetchFunction>();
  vi.stubGlobal("fetch", fetchMock);
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdminPage (caracterización US-14)", () => {
  it("sin juego (loading) muestra 'Cargando vista de admin...'", () => {
    adminMock.initialLoading = true;
    render(<AdminPage />);

    expect(screen.getByText("Cargando vista de admin...")).toBeTruthy();
    expect(
      screen.getByText("Si tarda mucho, intenta recargar la página")
    ).toBeTruthy();
  });

  it("status waiting renderiza AdminLobby con código y jugadores", () => {
    adminMock.initialGame = makeGame({ status: "waiting" });
    render(<AdminPage />);

    expect(screen.getByText(GAME_ID)).toBeTruthy();
    expect(screen.getByText("Jugadores (2)")).toBeTruthy();
    expect(screen.getByText("¡COMENZAR!")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ingreso abierto" })).toBeTruthy();
  });

  it("¡COMENZAR! hace POST start, setGame(data.game) y emite start-game", async () => {
    adminMock.initialGame = makeGame({ status: "waiting" });
    const started = makeGame({ status: "active" });
    fetchMock.mockResolvedValue(jsonResponse({ game: started }));

    render(<AdminPage />);
    fireEvent.click(screen.getByRole("button", { name: /¡COMENZAR!/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/games/${GAME_ID}/start`, {
        method: "POST",
      })
    );
    await waitFor(() =>
      expect(adminMock.emit).toHaveBeenCalledWith("start-game", {
        gameId: GAME_ID,
      })
    );
    expect(adminMock.setGameCalls).toEqual([started]);
    // Re-render con el juego activo: pasa a AdminPresentation.
    expect(await screen.findByText("Pregunta 1 / 1")).toBeTruthy();
  });

  it("si start falla alerta 'Failed to start game.' y no emite start-game", async () => {
    adminMock.initialGame = makeGame({ status: "waiting" });
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, false));

    render(<AdminPage />);
    fireEvent.click(screen.getByRole("button", { name: /¡COMENZAR!/ }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Failed to start game.")
    );
    expect(adminMock.emit).not.toHaveBeenCalled();
    expect(adminMock.setGameCalls).toEqual([]);
  });

  it("kick emite leave-game con el playerId", () => {
    adminMock.initialGame = makeGame({ status: "waiting" });
    render(<AdminPage />);

    fireEvent.click(screen.getByTitle("Expulsar a Ana"));

    expect(adminMock.emit).toHaveBeenCalledWith("leave-game", {
      gameId: GAME_ID,
      playerId: "p1",
    });
  });

  it("lock-game emite locked opuesto al estado actual", () => {
    adminMock.initialGame = makeGame({ status: "waiting", locked: false });
    const { unmount } = render(<AdminPage />);

    fireEvent.click(screen.getByRole("button", { name: "Ingreso abierto" }));
    expect(adminMock.emit).toHaveBeenCalledWith("lock-game", {
      gameId: GAME_ID,
      locked: true,
    });
    unmount();

    adminMock.emit.mockReset();
    adminMock.initialGame = makeGame({ status: "waiting", locked: true });
    render(<AdminPage />);

    fireEvent.click(screen.getByRole("button", { name: "Ingreso bloqueado" }));
    expect(adminMock.emit).toHaveBeenCalledWith("lock-game", {
      gameId: GAME_ID,
      locked: false,
    });
  });

  it("Cerrar partida pide confirmación, no emite al cancelar", () => {
    adminMock.initialGame = makeGame({ status: "waiting" });
    render(<AdminPage />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar partida" }));
    expect(screen.getByText("¿Cerrar esta partida?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Cerrar esta partida?")).toBeNull();
    expect(adminMock.emit).not.toHaveBeenCalled();
  });

  it("confirmar el cierre emite close-game y marca cancelled de forma optimista", async () => {
    adminMock.initialGame = makeGame({ status: "waiting" });
    render(<AdminPage />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar partida" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar" }));

    expect(adminMock.emit).toHaveBeenCalledWith("close-game", {
      gameId: GAME_ID,
    });
    expect((adminMock.currentGame as Game).status).toBe("cancelled");
    expect(await screen.findByText("Partida cerrada")).toBeTruthy();
  });

  it("status cancelled muestra 'Partida cerrada' con links", () => {
    adminMock.initialGame = makeGame({ status: "cancelled" });
    render(<AdminPage />);

    expect(screen.getByText("Partida cerrada")).toBeTruthy();
    expect(
      screen.getByText(
        "Esta partida nunca se inició y fue cerrada por el anfitrión o por inactividad."
      )
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Crear otro quiz" }).getAttribute("href")).toBe(
      "/create"
    );
    expect(screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href")).toBe(
      "/"
    );
  });

  it("Terminar pregunta emite finish-question y adelanta el startTime de forma optimista", () => {
    adminMock.initialGame = makeGame({
      status: "active",
      questions: [makeQuestion("q1"), makeQuestion("q2")],
    });
    render(<AdminPage />);

    expect(screen.getByText("Pregunta 1 / 2")).toBeTruthy();
    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: /Terminar pregunta/ }));
    const after = Date.now();

    expect(adminMock.emit).toHaveBeenCalledWith("finish-question", {
      gameId: GAME_ID,
    });
    const start = (adminMock.currentGame as Game).currentQuestionStartTime;
    expect(start).toBeGreaterThanOrEqual(before - 30000 - 50);
    expect(start).toBeLessThanOrEqual(after - 30000 + 50);
  });

  it("Siguiente pregunta emite next-question y avanza índice + startTime", async () => {
    timerMock.isFinished = true;
    adminMock.initialGame = makeGame({
      status: "active",
      questions: [makeQuestion("q1"), makeQuestion("q2")],
    });
    render(<AdminPage />);

    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente pregunta/ }));
    const after = Date.now();

    expect(adminMock.emit).toHaveBeenCalledWith("next-question", {
      gameId: GAME_ID,
    });
    const game = adminMock.currentGame as Game;
    expect(game.currentQuestionIndex).toBe(1);
    expect(game.currentQuestionStartTime).toBeGreaterThanOrEqual(before - 50);
    expect(game.currentQuestionStartTime).toBeLessThanOrEqual(after + 50);

    // Última pregunta + terminada ⇒ aparece Finalizar.
    expect(await screen.findByRole("button", { name: /Finalizar juego/ })).toBeTruthy();
  });

  it("Finalizar juego emite finish-game", () => {
    timerMock.isFinished = true;
    adminMock.initialGame = makeGame({
      status: "active",
      questions: [makeQuestion("q1"), makeQuestion("q2")],
      currentQuestionIndex: 1,
    });
    render(<AdminPage />);

    fireEvent.click(screen.getByRole("button", { name: /Finalizar juego/ }));

    expect(adminMock.emit).toHaveBeenCalledWith("finish-game", {
      gameId: GAME_ID,
    });
  });

  it("status finished pasa el juego y results a Results", () => {
    const results: GameResults = {
      gameId: GAME_ID,
      createdAt: new Date(0),
      totalPlayers: 2,
      totalQuestions: 1,
      leaderboard: [],
    };
    adminMock.initialGame = makeGame({ status: "finished" });
    adminMock.initialResults = results;

    render(<AdminPage />);

    expect(screen.getByText("results-mock")).toBeTruthy();
    expect(resultsCapture.props).toEqual({ gameId: GAME_ID, results });
  });
});
