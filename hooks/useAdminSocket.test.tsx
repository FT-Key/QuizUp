/**
 * CARACTERIZACIÓN US-13 — `useAdminSocket`.
 *
 * Congela el estado inicial, el request de estado al conectar, los retries de
 * 3000 ms con fallback HTTP, cada evento servidor→cliente y la delegación de
 * `emit`. Mockea el paquete `socket.io-client` (no `@/lib/socket`) para que los
 * tests sigan siendo válidos cuando el módulo se mueva a
 * `adapters/socket/socket-client.ts`.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Game, GameResults, Player } from "@/types";
import { asSocket, createFakeSocket, type FakeSocket } from "@/tests/fakes/socket";

const mocks = vi.hoisted(() => ({ io: vi.fn() }));

vi.mock("socket.io-client", () => ({ io: mocks.io }));

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const NOW = 1_700_000_000_000;

let fake: FakeSocket;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fake = createFakeSocket();
  mocks.io.mockReset();
  mocks.io.mockReturnValue(asSocket(fake));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const makePlayer = (id: string, name: string): Player => ({
  id,
  name,
  gameId: "g1",
  answers: {},
  score: 0,
  joinedAt: new Date(0),
});

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: "g1",
  name: "Partida",
  questions: [],
  createdAt: new Date(0),
  creatorId: "admin",
  status: "waiting",
  currentQuestionIndex: 0,
  players: [makePlayer("p1", "Ana"), makePlayer("p2", "Beto")],
  currentQuestionStartTime: 0,
  questionTimeLimit: 30000,
  ...overrides,
});

const makeResults = (): GameResults => ({
  gameId: "g1",
  createdAt: new Date(0),
  totalPlayers: 2,
  totalQuestions: 3,
  leaderboard: [],
});

const renderUseAdminSocket = async (gameId = "g1") => {
  const { useAdminSocket } = await import("@/hooks/useAdminSocket");
  return renderHook(() => useAdminSocket(gameId));
};

const advanceRetry = async (ticks = 1) => {
  for (let i = 0; i < ticks; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    });
  }
};

describe("useAdminSocket (caracterización US-13)", () => {
  it("el estado inicial es loading: true con game y results en null", async () => {
    const { result } = await renderUseAdminSocket();

    expect(result.current.loading).toBe(true);
    expect(result.current.game).toBeNull();
    expect(result.current.results).toBeNull();
  });

  it("al conectar emite join-admin y request-game-state con { gameId }", async () => {
    const { result } = await renderUseAdminSocket();

    act(() => {
      fake.setConnected(true);
    });

    expect(fake.emittedFor("join-admin")).toHaveLength(1);
    expect(fake.emittedFor("join-admin")[0].args).toEqual(["g1"]);

    const requests = fake.emittedFor("request-game-state");
    expect(requests.length).toBeGreaterThanOrEqual(1);
    expect(requests[0].args).toEqual([{ gameId: "g1" }]);
    expect(result.current.loading).toBe(true);
  });

  it("mientras loading, cada 3000 ms re-emite request-game-state (con conexión)", async () => {
    await renderUseAdminSocket();

    act(() => {
      fake.setConnected(true);
    });
    const initialRequests = fake.emittedFor("request-game-state").length;

    await advanceRetry(1);
    expect(fake.emittedFor("request-game-state")).toHaveLength(initialRequests + 1);

    await advanceRetry(1);
    expect(fake.emittedFor("request-game-state")).toHaveLength(initialRequests + 2);
    expect(fake.emittedFor("request-game-state")[0].args).toEqual([{ gameId: "g1" }]);
  });

  it("a los 5 reintentos llama fetch UNA vez (fallback HTTP) y setea game/loading", async () => {
    const httpGame = makeGame({ name: "Desde HTTP" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ game: httpGame }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = await renderUseAdminSocket();

    await advanceRetry(MAX_RETRIES - 1);
    expect(fetchMock).not.toHaveBeenCalled();

    await advanceRetry(1);
    // Deja drenar la cadena fetch → json → setState.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/games/g1");
    expect(result.current.game).toEqual(httpGame);
    expect(result.current.loading).toBe(false);

    // El fallback no se repite.
    await advanceRetry(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("game-updated setea el juego y apaga loading", async () => {
    const { result } = await renderUseAdminSocket();
    const updated = makeGame({ name: "Actualizado", currentQuestionStartTime: 1234 });

    act(() => {
      fake.trigger("game-updated", { game: updated });
    });

    expect(result.current.game).toEqual(updated);
    expect(result.current.loading).toBe(false);
  });

  it("CARACTERIZACIÓN: game-updated con currentQuestionStartTime 0 preserva el previo", async () => {
    const { result } = await renderUseAdminSocket();
    const withStartTime = makeGame({ currentQuestionStartTime: 1234 });

    act(() => {
      fake.trigger("game-updated", { game: withStartTime });
    });
    expect(result.current.game?.currentQuestionStartTime).toBe(1234);

    act(() => {
      fake.trigger("game-updated", {
        game: makeGame({ name: "Actualizado", currentQuestionStartTime: 0 }),
      });
    });

    expect(result.current.game?.name).toBe("Actualizado");
    expect(result.current.game?.currentQuestionStartTime).toBe(1234);
  });

  it("player-left con game en el payload setea ese juego", async () => {
    const { result } = await renderUseAdminSocket();
    const updated = makeGame({ players: [makePlayer("p2", "Beto")] });

    act(() => {
      fake.trigger("player-left", { playerId: "p1", game: updated });
    });

    expect(result.current.game).toEqual(updated);
  });

  it("player-left sin game en el payload filtra al jugador del estado previo", async () => {
    const { result } = await renderUseAdminSocket();

    act(() => {
      fake.trigger("game-updated", { game: makeGame() });
    });

    act(() => {
      fake.trigger("player-left", { playerId: "p1" });
    });

    expect(result.current.game?.players.map((player) => player.id)).toEqual(["p2"]);
  });

  it("question-finished fija currentQuestionStartTime en Date.now() - questionTimeLimit", async () => {
    const { result } = await renderUseAdminSocket();

    act(() => {
      fake.trigger("game-updated", { game: makeGame({ questionTimeLimit: 10000 }) });
    });

    act(() => {
      fake.trigger("question-finished", { currentQuestionIndex: 4 });
    });

    expect(result.current.game?.currentQuestionStartTime).toBe(NOW - 10000);
  });

  it("game-finished setea game, results y apaga loading", async () => {
    const { result } = await renderUseAdminSocket();
    const finishedGame = makeGame({ status: "finished" });
    const results = makeResults();

    act(() => {
      fake.trigger("game-finished", { game: finishedGame, results });
    });

    expect(result.current.game).toEqual(finishedGame);
    expect(result.current.results).toEqual(results);
    expect(result.current.loading).toBe(false);
  });

  it("game-finished sin game marca el juego previo como finished", async () => {
    const { result } = await renderUseAdminSocket();

    act(() => {
      fake.trigger("game-updated", { game: makeGame() });
    });

    act(() => {
      fake.trigger("game-finished", {});
    });

    expect(result.current.game?.status).toBe("finished");
    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("game-cancelled con game setea ese juego y apaga loading", async () => {
    const { result } = await renderUseAdminSocket();
    const cancelledGame = makeGame({ status: "cancelled" });

    act(() => {
      fake.trigger("game-cancelled", { game: cancelledGame });
    });

    expect(result.current.game).toEqual(cancelledGame);
    expect(result.current.loading).toBe(false);
  });

  it("game-cancelled sin game marca el juego previo como cancelled", async () => {
    const { result } = await renderUseAdminSocket();

    act(() => {
      fake.trigger("game-updated", { game: makeGame() });
    });

    act(() => {
      fake.trigger("game-cancelled", {});
    });

    expect(result.current.game?.status).toBe("cancelled");
    expect(result.current.loading).toBe(false);
  });

  it("game-state setea currentQuestionIndex y currentQuestionStartTime según timeLeft", async () => {
    const { result } = await renderUseAdminSocket();
    const incoming = makeGame({ questionTimeLimit: 20000 });

    act(() => {
      fake.trigger("game-state", {
        game: incoming,
        currentQuestion: null,
        currentQuestionIndex: 3,
        timeLeft: 5000,
      });
    });

    expect(result.current.game?.currentQuestionIndex).toBe(3);
    expect(result.current.game?.currentQuestionStartTime).toBe(NOW - 15000);
    expect(result.current.loading).toBe(false);
  });

  it("emit delega en socket.emit con el evento y los datos", async () => {
    const { result } = await renderUseAdminSocket();

    act(() => {
      result.current.emit("finish-game", { gameId: "g1" });
    });

    expect(fake.emittedFor("finish-game")).toEqual([
      { event: "finish-game", args: [{ gameId: "g1" }] },
    ]);
  });
});
