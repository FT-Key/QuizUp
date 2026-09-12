import { describe, expect, it, vi } from "vitest";
import { asRealtimeClient, createFakeSocket } from "@/tests/fakes/socket";
import { createSocketEventBus } from "./socket-event-bus";

const createBus = () => {
  const fake = createFakeSocket();
  return { fake, bus: createSocketEventBus(asRealtimeClient(fake)) };
};

describe("createSocketEventBus", () => {
  it("on registra un listener en el realtime y lo invoca con el payload", () => {
    const { fake, bus } = createBus();
    const handler = vi.fn();

    bus.on("joined", handler);

    expect(fake.listenerCount("joined")).toBe(1);

    fake.trigger("joined", { playerId: "p1" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ playerId: "p1" });
  });

  it("el Unsubscribe devuelto por on da de baja al listener", () => {
    const { fake, bus } = createBus();
    const handler = vi.fn();

    const unsubscribe = bus.on("joined", handler);

    unsubscribe();

    expect(fake.listenerCount("joined")).toBe(0);

    fake.trigger("joined", { playerId: "p1" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("off da de baja al listener", () => {
    const { fake, bus } = createBus();
    const handler = vi.fn();

    bus.on("joined", handler);
    bus.off("joined", handler);

    expect(fake.listenerCount("joined")).toBe(0);
  });

  it("emit delega en el realtime en orden y con los args exactos", () => {
    const { fake, bus } = createBus();
    const answer = {
      gameId: "g1",
      playerId: "p1",
      questionId: "q1",
      answer: 2,
    };

    bus.emit("join-admin", "g1");
    bus.emit("request-dashboard");
    bus.emit("submit-answer", answer);

    expect(fake.emitted).toEqual([
      { event: "join-admin", args: ["g1"] },
      { event: "request-dashboard", args: [] },
      { event: "submit-answer", args: [answer] },
    ]);
  });

  it("emit de join-game acepta playerId null (drift §10-D3) y conserva el payload", () => {
    const { fake, bus } = createBus();

    bus.emit("join-game", {
      gameId: "g1",
      playerId: null,
      playerName: "Ana",
      avatar: { seed: "Ana", accessories: [] },
    });

    expect(fake.emittedFor("join-game")).toEqual([
      {
        event: "join-game",
        args: [
          {
            gameId: "g1",
            playerId: null,
            playerName: "Ana",
            avatar: { seed: "Ana", accessories: [] },
          },
        ],
      },
    ]);
  });
});
