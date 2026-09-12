/**
 * CARACTERIZACIÓN US-13 — `adapters/socket/socket-client.ts` (singleton y opciones de conexión).
 *
 * Deriva de `lib/socket.test.ts` (US-13): el cuerpo de `lib/socket.ts` se movió a
 * `adapters/socket/socket-client.ts` y este archivo solo cambió el import del
 * módulo bajo prueba. US-15 retiró la API de socket muerta y sus casos; la suite
 * vigente caracteriza únicamente `initSocket`: singleton, URL por defecto/entorno
 * y opciones de reconexión.
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
});
