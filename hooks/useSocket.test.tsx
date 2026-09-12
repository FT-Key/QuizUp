/**
 * CARACTERIZACIÓN US-13 — `useSocket`.
 *
 * Congela el flujo actual de conexión/join del jugador y del admin, el registro
 * de `events` y la delegación de `emit`. Mockea el paquete `socket.io-client`
 * (no `@/lib/socket`) para que los tests sigan siendo válidos cuando el módulo
 * se mueva a `adapters/socket/socket-client.ts`.
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

interface UseSocketOptions {
  gameId: string;
  playerName?: string;
  isAdmin?: boolean;
  events?: TestSocketEvent[];
}

interface JoinGamePayload {
  gameId: string;
  playerId: string | null;
  playerName: string;
  avatar: { seed: string; accessories: string[] };
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

const renderUseSocket = async (options: UseSocketOptions) => {
  const { useSocket } = await import("@/hooks/useSocket");
  return renderHook(() => useSocket(options));
};

const firstJoinPayload = (): JoinGamePayload => {
  const calls = fake.emittedFor("join-game");
  expect(calls).toHaveLength(1);
  return calls[0].args[0] as JoinGamePayload;
};

describe("useSocket (caracterización US-13)", () => {
  it("un jugador con sesión guardada emite join-game con playerId y avatar al conectar", async () => {
    localStorage.setItem("playerName", "Ana");
    localStorage.setItem("playerId", "p1");
    localStorage.setItem("playerAvatarSeed", "Felix");
    localStorage.setItem("playerAvatarAccessories", JSON.stringify(["hat", "glasses"]));

    const { result } = await renderUseSocket({ gameId: "g1" });
    expect(result.current.connected).toBe(false);

    act(() => {
      fake.trigger("connect");
    });

    expect(result.current.connected).toBe(true);
    expect(firstJoinPayload()).toEqual({
      gameId: "g1",
      playerId: "p1",
      playerName: "Ana",
      avatar: { seed: "Felix", accessories: ["hat", "glasses"] },
    });
  });

  it("playerName prop tiene prioridad sobre localStorage (y también siembra el avatar)", async () => {
    localStorage.setItem("playerName", "Guardado");

    await renderUseSocket({ gameId: "g1", playerName: "Prop" });

    act(() => {
      fake.trigger("connect");
    });

    expect(firstJoinPayload()).toEqual({
      gameId: "g1",
      playerId: null,
      playerName: "Prop",
      avatar: { seed: "Prop", accessories: [] },
    });
  });

  it("sin playerName (prop y storage) no emite join-game", async () => {
    const { result } = await renderUseSocket({ gameId: "g1" });

    act(() => {
      fake.trigger("connect");
    });

    expect(result.current.connected).toBe(true);
    expect(fake.emittedFor("join-game")).toHaveLength(0);
    expect(fake.emitted).toHaveLength(0);
  });

  it("sin playerAvatarSeed el avatar usa el nombre como seed", async () => {
    localStorage.setItem("playerName", "Ana");

    await renderUseSocket({ gameId: "g1" });

    act(() => {
      fake.trigger("connect");
    });

    expect(firstJoinPayload().avatar).toEqual({ seed: "Ana", accessories: [] });
  });

  it("playerAvatarAccessories con JSON inválido cae a [] sin lanzar", async () => {
    localStorage.setItem("playerName", "Ana");
    localStorage.setItem("playerAvatarAccessories", "{esto no es json");

    await renderUseSocket({ gameId: "g1" });

    act(() => {
      fake.trigger("connect");
    });

    expect(firstJoinPayload().avatar).toEqual({ seed: "Ana", accessories: [] });
  });

  it("el flujo admin emite join-admin con el gameId y no lee localStorage", async () => {
    localStorage.setItem("playerName", "Ana");
    localStorage.setItem("playerId", "p1");
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    await renderUseSocket({ gameId: "g1", isAdmin: true });

    act(() => {
      fake.trigger("connect");
    });

    expect(fake.emittedFor("join-admin")).toHaveLength(1);
    expect(fake.emittedFor("join-admin")[0].args).toEqual(["g1"]);
    expect(fake.emittedFor("join-game")).toHaveLength(0);
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it("connected arranca en false y sigue los eventos connect/disconnect", async () => {
    const { result } = await renderUseSocket({ gameId: "g1" });
    expect(result.current.connected).toBe(false);

    act(() => {
      fake.trigger("connect");
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      fake.trigger("disconnect");
    });
    expect(result.current.connected).toBe(false);
  });

  it("si el socket ya está conectado al montar, el join se emite sin esperar el evento connect", async () => {
    localStorage.setItem("playerName", "Ana");
    fake.connected = true;

    const { result } = await renderUseSocket({ gameId: "g1" });

    expect(result.current.connected).toBe(true);
    expect(firstJoinPayload().playerName).toBe("Ana");
  });

  it("CARACTERIZACIÓN: una reconexión emite join-game otra vez (una emisión por connect)", async () => {
    localStorage.setItem("playerName", "Ana");

    await renderUseSocket({ gameId: "g1" });

    act(() => {
      fake.trigger("connect");
    });
    act(() => {
      fake.trigger("connect");
    });

    expect(fake.emittedFor("join-game")).toHaveLength(2);
  });

  it("registra cada event en on, lo invoca con el payload y lo desregistra en off al desmontar", async () => {
    const onJoined = vi.fn();
    const onAnswerSubmitted = vi.fn();

    const { unmount } = await renderUseSocket({
      gameId: "g1",
      events: [
        { event: "joined", callback: onJoined },
        { event: "answer-submitted", callback: onAnswerSubmitted },
      ],
    });

    expect(fake.listenerCount("joined")).toBe(1);
    expect(fake.listenerCount("answer-submitted")).toBe(1);

    act(() => {
      fake.trigger("joined", { playerId: "p1" });
      fake.trigger("answer-submitted", { playerId: "p1", answer: 2 });
    });

    expect(onJoined).toHaveBeenCalledWith({ playerId: "p1" });
    expect(onAnswerSubmitted).toHaveBeenCalledWith({ playerId: "p1", answer: 2 });

    unmount();

    expect(fake.listenerCount("joined")).toBe(0);
    expect(fake.listenerCount("answer-submitted")).toBe(0);
  });

  it("emit delega en socket.emit con el evento y los datos", async () => {
    const { result } = await renderUseSocket({ gameId: "g1" });

    act(() => {
      result.current.emit("start-game", { gameId: "g1" });
    });

    expect(fake.emittedFor("start-game")).toEqual([
      { event: "start-game", args: [{ gameId: "g1" }] },
    ]);
  });
});
