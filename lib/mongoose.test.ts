import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// US-09: caracterización de `lib/mongoose.ts` (legacy) sin red ni Mongo real.
// El módulo lee `process.env.MONGODB_URI` e inicializa `global.mongooseCache`
// AL IMPORTARSE, por eso cada test limpia el registro de módulos y el cache
// global antes de hacer el dynamic import.

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: { connect: connectMock },
}));

const FALLBACK_URI = "mongodb://localhost:27017/quizapp";

type ConnectToDB = () => Promise<unknown>;

async function importConnectToDB(): Promise<ConnectToDB> {
  const mongooseModule = await import("@/lib/mongoose");
  return mongooseModule.default as ConnectToDB;
}

function clearGlobalCache(): void {
  Reflect.deleteProperty(globalThis, "mongooseCache");
}

function connectionStub() {
  return { connection: { readyState: 1 } };
}

describe("lib/mongoose — cache global y resolución de MONGODB_URI", () => {
  beforeEach(() => {
    vi.resetModules();
    connectMock.mockReset();
    clearGlobalCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearGlobalCache();
  });

  it("sin MONGODB_URI usa el fallback mongodb://localhost:27017/quizapp", async () => {
    // CARACTERIZACIÓN: el guard `if (!MONGODB_URI) throw` es código muerto
    // porque el fallback siempre asigna un string truthy; con env vacía conecta igual.
    vi.stubEnv("MONGODB_URI", "");
    const connection = connectionStub();
    connectMock.mockResolvedValue(connection);

    const connectToDB = await importConnectToDB();
    const result = await connectToDB();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(FALLBACK_URI);
    expect(result).toBe(connection);
  });

  it("con MONGODB_URI definida usa exactamente esa URI", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb://user:pass@db.example.com:27017/quizup");
    const connection = connectionStub();
    connectMock.mockResolvedValue(connection);

    const connectToDB = await importConnectToDB();
    await connectToDB();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(
      "mongodb://user:pass@db.example.com:27017/quizup"
    );
  });

  it("dos llamadas secuenciales conectan una sola vez y devuelven la misma conexión", async () => {
    vi.stubEnv("MONGODB_URI", FALLBACK_URI);
    const connection = connectionStub();
    connectMock.mockResolvedValue(connection);

    const connectToDB = await importConnectToDB();
    const first = await connectToDB();
    const second = await connectToDB();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(connection);
    expect(second).toBe(connection);
    expect(second).toBe(first);
  });

  it("dos llamadas concurrentes comparten el mismo promise y conectan una sola vez", async () => {
    vi.stubEnv("MONGODB_URI", FALLBACK_URI);
    const connection = connectionStub();
    let resolveConnect: (value: unknown) => void = () => {};
    connectMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConnect = resolve;
        })
    );

    const connectToDB = await importConnectToDB();
    const firstPromise = connectToDB();
    const secondPromise = connectToDB();

    // Antes de resolver el deferred: connect ya se llamó una sola vez.
    expect(connectMock).toHaveBeenCalledTimes(1);

    resolveConnect(connection);

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toBe(connection);
    expect(second).toBe(connection);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("guarda en globalThis.mongooseCache el shape { conn, promise }", async () => {
    vi.stubEnv("MONGODB_URI", FALLBACK_URI);
    const connection = connectionStub();
    connectMock.mockResolvedValue(connection);

    const connectToDB = await importConnectToDB();
    await connectToDB();

    const cache = globalThis.mongooseCache;
    expect(cache.conn).toBe(connection);
    expect(cache.promise).toBeInstanceOf(Promise);
    await expect(cache.promise).resolves.toBe(connection);
  });

  it("reutiliza un cache global preexistente en lugar de crear uno nuevo", async () => {
    vi.stubEnv("MONGODB_URI", FALLBACK_URI);
    const cachedConnection = connectionStub();
    globalThis.mongooseCache = {
      conn: cachedConnection as unknown as typeof globalThis.mongooseCache.conn,
      promise: null,
    };

    const connectToDB = await importConnectToDB();
    const result = await connectToDB();

    expect(result).toBe(cachedConnection);
    expect(connectMock).not.toHaveBeenCalled();
  });
});
