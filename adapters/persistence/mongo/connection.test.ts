import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// US-09 (D5): paridad con `lib/mongoose.test.ts` para el adaptador nuevo.
// La URI entra por parámetro; el cache global es el mismo
// `globalThis.mongooseCache` que usa el legacy. Sin red ni Mongo real.

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: { connect: connectMock },
}));

type ConnectToMongo = (mongoUri: string) => Promise<unknown>;

async function importConnectToMongo(): Promise<ConnectToMongo> {
  const connectionModule = await import("@/adapters/persistence/mongo/connection");
  return connectionModule.connectToMongo;
}

function clearGlobalCache(): void {
  Reflect.deleteProperty(globalThis, "mongooseCache");
}

function connectionStub() {
  return { connection: { readyState: 1 } };
}

const URI = "mongodb://localhost:27017/quizapp";

describe("adapters/persistence/mongo/connection — cache global y URI por parámetro", () => {
  beforeEach(() => {
    vi.resetModules();
    connectMock.mockReset();
    clearGlobalCache();
  });

  afterEach(() => {
    clearGlobalCache();
  });

  it("primera llamada conecta una vez con la URI recibida y devuelve la conexión", async () => {
    const connection = connectionStub();
    connectMock.mockResolvedValue(connection);

    const connectToMongo = await importConnectToMongo();
    const result = await connectToMongo(URI);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(URI);
    expect(result).toBe(connection);
  });

  it("dos llamadas secuenciales conectan una sola vez y devuelven la misma conexión", async () => {
    const connection = connectionStub();
    connectMock.mockResolvedValue(connection);

    const connectToMongo = await importConnectToMongo();
    const first = await connectToMongo(URI);
    const second = await connectToMongo(URI);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(connection);
    expect(second).toBe(connection);
  });

  it("dos llamadas concurrentes comparten el mismo promise y conectan una sola vez", async () => {
    const connection = connectionStub();
    let resolveConnect: (value: unknown) => void = () => {};
    connectMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConnect = resolve;
        })
    );

    const connectToMongo = await importConnectToMongo();
    const firstPromise = connectToMongo(URI);
    const secondPromise = connectToMongo(URI);

    expect(connectMock).toHaveBeenCalledTimes(1);

    resolveConnect(connection);

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toBe(connection);
    expect(second).toBe(connection);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("reutiliza un cache global preexistente sin conectar", async () => {
    const cachedConnection = connectionStub();
    globalThis.mongooseCache = {
      conn: cachedConnection as unknown as typeof globalThis.mongooseCache.conn,
      promise: null,
    };

    const connectToMongo = await importConnectToMongo();
    const result = await connectToMongo(URI);

    expect(result).toBe(cachedConnection);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("deja el shape { conn, promise } en globalThis y no reconecta con otra URI", async () => {
    const connection = connectionStub();
    connectMock.mockResolvedValue(connection);

    const connectToMongo = await importConnectToMongo();
    await connectToMongo(URI);

    const cache = globalThis.mongooseCache;
    expect(cache.conn).toBe(connection);
    expect(cache.promise).toBeInstanceOf(Promise);
    await expect(cache.promise).resolves.toBe(connection);

    const other = await connectToMongo("mongodb://other-host:27017/other");
    expect(other).toBe(connection);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(URI);
  });
});
