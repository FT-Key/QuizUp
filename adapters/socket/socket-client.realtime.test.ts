/**
 * US-13 (aditivo) — glue de `createSocketRealtimeClient` sobre el socket singleton.
 * El test migrado `socket-client.test.ts` congela el singleton; este archivo cubre
 * la adaptación al puerto `RealtimeClient`. No usa red real: `io` está mockeado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asSocket, createFakeSocket, type FakeSocket } from "@/tests/fakes/socket";

const mocks = vi.hoisted(() => ({ io: vi.fn() }));

vi.mock("socket.io-client", () => ({ io: mocks.io }));

describe("createSocketRealtimeClient (adapter al puerto RealtimeClient)", () => {
  let fake: FakeSocket;

  beforeEach(() => {
    vi.resetModules();
    fake = createFakeSocket({ connected: false });
    mocks.io.mockReset();
    mocks.io.mockReturnValue(asSocket(fake));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const loadClient = async () => {
    const { createSocketRealtimeClient } = await import(
      "@/adapters/socket/socket-client"
    );
    return createSocketRealtimeClient();
  };

  it("expone `connected` del socket en vivo", async () => {
    const client = await loadClient();

    expect(client.connected).toBe(false);

    fake.connected = true;

    expect(client.connected).toBe(true);
  });

  it("on registra en el socket; el unsubscribe da de baja", async () => {
    const client = await loadClient();
    const handler = vi.fn();

    const unsubscribe = client.on("joined", handler);

    expect(fake.listenerCount("joined")).toBe(1);

    fake.trigger("joined", { ok: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ ok: true });

    unsubscribe();

    expect(fake.listenerCount("joined")).toBe(0);
  });

  it("off da de baja al handler", async () => {
    const client = await loadClient();
    const handler = vi.fn();

    client.on("joined", handler);
    client.off("joined", handler);

    expect(fake.listenerCount("joined")).toBe(0);
  });

  it("emit delega evento y argumentos en el socket", async () => {
    const client = await loadClient();

    client.emit("join-admin", "game-1");

    expect(fake.emittedFor("join-admin")).toEqual([
      { event: "join-admin", args: ["game-1"] },
    ]);
  });
});
