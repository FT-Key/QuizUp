/**
 * US-13 — invariantes de implementación de `useAdminSocket` sobre la facade.
 *
 * (a) Si llega estado por socket a mitad de los retries, `loading` se apaga,
 *     los ticks dejan de emitir `request-game-state` y el fallback HTTP no se
 *     ejecuta (el efecto limpia la suscripción del retry).
 * (b) El fallback HTTP se ejecuta exactamente una vez al agotar los retries.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Game } from "@/types";
import { asSocket, createFakeSocket, type FakeSocket } from "@/tests/fakes/socket";

const mocks = vi.hoisted(() => ({ io: vi.fn() }));

vi.mock("socket.io-client", () => ({ io: mocks.io }));

const RETRY_DELAY_MS = 3000;

let fake: FakeSocket;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
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

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: "g1",
  name: "Partida",
  questions: [],
  createdAt: new Date(0),
  creatorId: "admin",
  status: "waiting",
  currentQuestionIndex: 0,
  players: [],
  currentQuestionStartTime: 0,
  questionTimeLimit: 30000,
  ...overrides,
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

describe("useAdminSocket implementación (US-13)", () => {
  it("game-updated a mitad de retries apaga loading, frena los ticks y evita el fallback HTTP", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = await renderUseAdminSocket();

    act(() => {
      fake.setConnected(true);
    });

    await advanceRetry(2);
    // Request inicial del connect + un request por cada tick de retry.
    const requestsBeforeState = fake.emittedFor("request-game-state").length;
    expect(requestsBeforeState).toBe(3);

    act(() => {
      fake.trigger("game-updated", { game: makeGame({ name: "En vivo" }) });
    });

    expect(result.current.loading).toBe(false);

    await advanceRetry(4);

    expect(fake.emittedFor("request-game-state")).toHaveLength(requestsBeforeState);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el fallback HTTP se ejecuta exactamente una vez al agotar los retries", async () => {
    const httpGame = makeGame({ name: "Desde HTTP" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ game: httpGame }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = await renderUseAdminSocket();

    act(() => {
      fake.setConnected(true);
    });

    await advanceRetry(5);
    // Deja drenar la cadena fetch → json → setState.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/games/g1");
    expect(result.current.game).toEqual(httpGame);
    expect(result.current.loading).toBe(false);

    await advanceRetry(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
