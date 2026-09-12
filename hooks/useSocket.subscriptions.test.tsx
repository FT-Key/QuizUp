/**
 * US-13 — suscripción estable de `useSocket` sobre `GameSessionFacade`.
 *
 * Invariante nuevo: un array NUEVO con el mismo nombre de evento no re-suscribe
 * (el listener sigue siendo uno) y el wrapper entrega siempre el callback más
 * reciente vía `handlersRef`. Al desmontar no queda ningún listener.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asSocket, createFakeSocket, type FakeSocket } from "@/tests/fakes/socket";

const mocks = vi.hoisted(() => ({ io: vi.fn() }));

vi.mock("socket.io-client", () => ({ io: mocks.io }));

interface TestSocketEvent {
  event: string;
  callback: (...args: unknown[]) => void;
}

let fake: FakeSocket;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  fake = createFakeSocket();
  mocks.io.mockReset();
  mocks.io.mockReturnValue(asSocket(fake));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useSocket suscripciones (US-13)", () => {
  it("un array nuevo con el mismo evento mantiene 1 listener y usa el callback nuevo", async () => {
    const { useSocket } = await import("@/hooks/useSocket");
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    const { rerender, unmount } = renderHook(
      ({ events }: { events: TestSocketEvent[] }) =>
        useSocket({ gameId: "g1", events }),
      {
        initialProps: {
          events: [{ event: "joined", callback: firstCallback }],
        },
      }
    );

    expect(fake.listenerCount("joined")).toBe(1);

    rerender({
      events: [{ event: "joined", callback: secondCallback }],
    });

    expect(fake.listenerCount("joined")).toBe(1);

    act(() => {
      fake.trigger("joined", { playerId: "p1" });
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledWith({ playerId: "p1" });

    unmount();

    expect(fake.listenerCount("joined")).toBe(0);
  });
});
