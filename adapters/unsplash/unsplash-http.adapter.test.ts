import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageSearchGateway } from "@/core/application/ports/image-search";
import type { Logger } from "@/core/application/ports/logger";
import { manualClock, type ManualClock } from "@/tests/fakes/system";
import { createUnsplashSearchGateway } from "./unsplash-http.adapter";

// US-12 §6: adaptador HTTP de Unsplash. La caracterización del contrato REST
// vive en `tests/api/legacy-unsplash-contract.test.ts`; acá se fijan URL/headers
// exactos, el mapeo con fallbacks, el cooldown de 2 min y que la key nunca
// aparezca en los logs (solo en el header Authorization).

const ACCESS_KEY = "unsplash-test-key-9f3a1c";
const COOLDOWN_MS = 2 * 60 * 1000;

interface UpstreamInit {
  status?: number;
  ok?: boolean;
  json?: unknown;
  bodyText?: string;
  headers?: Record<string, string>;
}

/** Respuesta upstream mínima con la superficie que consume el adaptador. */
function upstreamResponse(init: UpstreamInit = {}): Response {
  const status = init.status ?? 200;
  const headers = Object.fromEntries(
    Object.entries(init.headers ?? {}).map(([name, value]) => [
      name.toLowerCase(),
      value,
    ])
  );
  return {
    status,
    ok: init.ok ?? (status >= 200 && status < 300),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: vi.fn(async () => init.json ?? { results: [], total_pages: 1 }),
    text: vi.fn(async () => init.bodyText ?? ""),
  } as unknown as Response;
}

interface RecordedLog {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  meta?: unknown;
}

function recordingLogger(): { logger: Logger; logs: RecordedLog[] } {
  const logs: RecordedLog[] = [];
  const record =
    (level: RecordedLog["level"]) =>
    (message: string, meta?: unknown): void => {
      logs.push({ level, message, meta });
    };
  return {
    logger: {
      debug: record("debug"),
      info: record("info"),
      warn: record("warn"),
      error: record("error"),
    },
    logs,
  };
}

interface SetupResult {
  gateway: ImageSearchGateway;
  fetchMock: ReturnType<typeof vi.fn>;
  clock: ManualClock;
  logger: Logger;
  logs: RecordedLog[];
}

function setup(init: UpstreamInit = {}, now = 0): SetupResult {
  const clock = manualClock(now);
  const { logger, logs } = recordingLogger();
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => upstreamResponse(init)
  );
  vi.stubGlobal("fetch", fetchMock);
  const gateway = createUnsplashSearchGateway({
    accessKey: ACCESS_KEY,
    clock: clock.clock,
    logger,
    fetch,
  });
  return { gateway, fetchMock, clock, logger, logs };
}

const PHOTOS = {
  total_pages: 5,
  results: [
    {
      id: "photo-1",
      urls: {
        regular: "https://images.unsplash.com/regular-1.jpg",
        small: "https://images.unsplash.com/small-1.jpg",
      },
      alt_description: "Una montaña",
      user: { name: "Ana", links: { html: "https://unsplash.com/@ana" } },
    },
    {
      id: "photo-2",
      urls: {
        full: "https://images.unsplash.com/full-2.jpg",
        thumb: "https://images.unsplash.com/thumb-2.jpg",
      },
      alt_description: null,
      description: "Descripción alternativa",
      user: null,
    },
    {
      id: "photo-3",
      urls: { regular: "https://images.unsplash.com/regular-3.jpg" },
      alt_description: "",
      description: null,
      user: { name: "", links: {} },
    },
  ],
};

describe("adapters/unsplash/unsplash-http", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("arma la URL y los headers exactos y expone hasCredentials sin la key", async () => {
    const { gateway, fetchMock, clock, logger } = setup();

    expect(gateway.hasCredentials()).toBe(true);
    const withoutKey = createUnsplashSearchGateway({
      accessKey: null,
      clock: clock.clock,
      logger,
      fetch,
    });
    expect(withoutKey.hasCredentials()).toBe(false);

    const result = await gateway.search({ query: "Foo   Bar", page: 3 });

    expect(result.kind).toBe("ok");
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      "https://api.unsplash.com/search/photos"
    );
    expect(calledUrl.searchParams.get("query")).toBe("Foo   Bar");
    expect(calledUrl.searchParams.get("page")).toBe("3");
    expect(calledUrl.searchParams.get("per_page")).toBe("24");
    expect(calledUrl.searchParams.get("orientation")).toBe("landscape");
    expect(calledUrl.searchParams.get("content_filter")).toBe("high");
    expect(fetchMock).toHaveBeenCalledWith(calledUrl.toString(), {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
      cache: "no-store",
    });
  });

  it("mapea las fotos con los fallbacks exactos del legacy (siempre 6 claves)", async () => {
    const { gateway } = setup({ json: PHOTOS });

    const result = await gateway.search({ query: "Foo   Bar", page: 1 });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.payload).toEqual({
      results: [
        {
          id: "photo-1",
          url: "https://images.unsplash.com/regular-1.jpg",
          thumb: "https://images.unsplash.com/small-1.jpg",
          alt: "Una montaña",
          author: "Ana",
          authorLink: "https://unsplash.com/@ana",
        },
        {
          id: "photo-2",
          url: "https://images.unsplash.com/full-2.jpg",
          thumb: "https://images.unsplash.com/thumb-2.jpg",
          alt: "Descripción alternativa",
          author: "",
          authorLink: "",
        },
        {
          id: "photo-3",
          url: "https://images.unsplash.com/regular-3.jpg",
          thumb: undefined,
          alt: "Foo   Bar",
          author: "",
          authorLink: "",
        },
      ],
      page: 1,
      totalPages: 5,
    });
    expect(Object.keys(result.payload.results[2])).toEqual([
      "id",
      "url",
      "thumb",
      "alt",
      "author",
      "authorLink",
    ]);
  });

  it("sin total_pages usa 1 y sin results usa []", async () => {
    const { gateway } = setup({ json: { results: [] } });

    const result = await gateway.search({ query: "gatos", page: 1 });

    expect(result).toEqual({
      kind: "ok",
      payload: { results: [], page: 1, totalPages: 1 },
    });
  });

  it("un 403 devuelve provider_rate_limited, loguea y activa un cooldown de 2 min", async () => {
    const { gateway, fetchMock, clock, logs } = setup({ status: 403 });

    const first = await gateway.search({ query: "gatos", page: 1 });
    const second = await gateway.search({ query: "perros", page: 1 });

    expect(first).toEqual({ kind: "provider_rate_limited" });
    expect(second).toEqual({ kind: "provider_cooldown" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logs).toEqual([
      {
        level: "error",
        message: "[unsplash] límite de búsquedas alcanzado (403)",
        meta: undefined,
      },
    ]);

    // Tras el cooldown vuelve a llamar; el upstream ahora responde OK.
    clock.advance(COOLDOWN_MS);
    fetchMock.mockImplementationOnce(async () => upstreamResponse());
    const third = await gateway.search({ query: "perros", page: 1 });
    expect(third.kind).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un status no-ok devuelve provider_error con el status y loguea el detalle", async () => {
    const { gateway, logs } = setup({ status: 500, bodyText: "boom" });

    const result = await gateway.search({ query: "gatos", page: 1 });

    expect(result).toEqual({ kind: "provider_error", status: 500 });
    expect(logs).toEqual([
      {
        level: "error",
        message: "[unsplash] error",
        meta: { status: 500, detail: "boom" },
      },
    ]);
  });

  it("x-ratelimit-remaining 0 activa el cooldown; un valor > 0 no bloquea", async () => {
    const zero = setup({ headers: { "x-ratelimit-remaining": "0" } });
    const first = await zero.gateway.search({ query: "gatos", page: 1 });
    const second = await zero.gateway.search({ query: "perros", page: 1 });

    expect(first.kind).toBe("ok");
    expect(second).toEqual({ kind: "provider_cooldown" });
    expect(zero.fetchMock).toHaveBeenCalledTimes(1);

    const positive = setup({ headers: { "x-ratelimit-remaining": "5" } });
    await positive.gateway.search({ query: "gatos", page: 1 });
    await positive.gateway.search({ query: "perros", page: 1 });
    expect(positive.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un rechazo de fetch se propaga (la ruta lo mapea a 500)", async () => {
    const { logger, clock } = setup();
    const fetchMock = vi.fn(async () => {
      throw new Error("fallo de red");
    });
    vi.stubGlobal("fetch", fetchMock);
    const gateway = createUnsplashSearchGateway({
      accessKey: ACCESS_KEY,
      clock: clock.clock,
      logger,
      fetch,
    });

    await expect(
      gateway.search({ query: "gatos", page: 1 })
    ).rejects.toThrow("fallo de red");
  });

  it("la key solo viaja en el header Authorization: nunca en los logs", async () => {
    const forbidden = setup({ status: 403 });
    await forbidden.gateway.search({ query: "gatos", page: 1 });

    const upstreamError = setup({ status: 500, bodyText: "detalle interno" });
    await upstreamError.gateway.search({ query: "gatos", page: 1 });

    const logs = [...forbidden.logs, ...upstreamError.logs];
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(JSON.stringify(log)).not.toContain(ACCESS_KEY);
    }
    expect(JSON.stringify(forbidden.fetchMock.mock.calls[0][1])).toContain(
      ACCESS_KEY
    );
  });
});
