/**
 * CARACTERIZACIÓN US-13 — `adapters/socket/socket-client.ts` (singleton y opciones de conexión).
 *
 * Migrado 1:1 desde `lib/socket.test.ts` en US-13: el cuerpo de `lib/socket.ts` se
 * movió a `adapters/socket/socket-client.ts` y este archivo solo cambia el import
 * del módulo bajo prueba. Las 6 aserciones se mantienen intactas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asSocket, createFakeSocket, type FakeSocket } from "@/tests/fakes/socket";

const mocks = vi.hoisted(() => ({ io: vi.fn() }));

vi.mock("socket.io-client", () => ({ io: mocks.io }));

const DEFAULT_URL = "http://localhost:4000";

const EXPECTED_OPTIONS = {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
};

async function loadSocketModule(): Promise<
  typeof import("@/adapters/socket/socket-client")
> {
  return import("@/adapters/socket/socket-client");
}

describe("adapters/socket/socket-client (caracterización US-13)", () => {
  const created: FakeSocket[] = [];

  beforeEach(() => {
    vi.resetModules();
    // Aísla cada test del valor real de la variable de entorno.
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "");
    created.length = 0;
    mocks.io.mockReset();
    mocks.io.mockImplementation(() => {
      const fake = createFakeSocket({ id: `socket-${created.length + 1}` });
      created.push(fake);
      return asSocket(fake);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("llamadas repetidas a initSocket devuelven la MISMA instancia (singleton)", async () => {
    const { initSocket } = await loadSocketModule();

    const first = initSocket();
    const second = initSocket();

    expect(first).toBe(second);
    expect(first).toBe(created[0]);
    expect(mocks.io).toHaveBeenCalledTimes(1);
  });

  it("initSocket llama a io con la URL por defecto y las opciones exactas de reconexión", async () => {
    const { initSocket } = await loadSocketModule();

    initSocket();

    expect(mocks.io).toHaveBeenCalledTimes(1);
    expect(mocks.io).toHaveBeenCalledWith(DEFAULT_URL, EXPECTED_OPTIONS);
  });

  it("initSocket respeta NEXT_PUBLIC_SOCKET_URL cuando está definida", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "https://sockets.example.test");
    const { initSocket } = await loadSocketModule();

    initSocket();

    expect(mocks.io).toHaveBeenCalledWith("https://sockets.example.test", EXPECTED_OPTIONS);
  });

  it("getSocket es null antes de init y devuelve la instancia después", async () => {
    const { getSocket, initSocket } = await loadSocketModule();

    expect(getSocket()).toBeNull();

    const socket = initSocket();

    expect(getSocket()).toBe(socket);
    expect(getSocket()).toBe(created[0]);
  });

  it("disconnectSocket llama a disconnect() y deja getSocket() en null", async () => {
    const { disconnectSocket, getSocket, initSocket } = await loadSocketModule();

    initSocket();
    disconnectSocket();

    expect(created[0].disconnectedCount).toBe(1);
    expect(getSocket()).toBeNull();
  });

  it("tras desconectar, un nuevo initSocket crea otra instancia", async () => {
    const { disconnectSocket, initSocket } = await loadSocketModule();

    const first = initSocket();
    disconnectSocket();
    const second = initSocket();

    expect(second).not.toBe(first);
    expect(created).toHaveLength(2);
    expect(mocks.io).toHaveBeenCalledTimes(2);
  });
});
