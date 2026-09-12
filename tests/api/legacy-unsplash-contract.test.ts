import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// US-12: caracterización COMPLETA de `app/api/unsplash/search/route.ts`
// (pre-refactor). Congela status HTTP, bodies, headers, el mapeo exacto de
// fotos, el orden real de las comprobaciones (query → rate limit por IP → key →
// caché → cooldown upstream) y los estados a nivel de módulo (cache de 24 h con
// clave normalizada, rate limit de 30 req/min, cooldown de 2 min tras 403 o
// `x-ratelimit-remaining: 0`). El refactor de US-12 debe reproducir todo esto
// byte a byte.
//
// Sin red ni timers reales: se mockea `next/server` (capturando body/status/
// headers ANTES de que Next los serialice), y se stubbean `fetch`,
// `UNSPLASH_ACCESS_KEY` y el reloj. La ruta guarda estado en variables de
// módulo, así que cada test la reimporta tras `vi.resetModules()` para arrancar
// con caché/rate-limit/cooldown limpios.

const { jsonMock } = vi.hoisted(() => ({
  jsonMock: vi.fn(
    (
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) => ({
      body,
      status: init?.status ?? 200,
      headers: init?.headers,
    })
  ),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: jsonMock },
}));

const ACCESS_KEY = "unsplash-test-key-9f3a1c";
const BASE_URL = "http://localhost:3000/api/unsplash/search";

interface CapturedResponse {
  /** Body pre-serialización capturado por el mock de `NextResponse.json`. */
  body: any;
  status: number;
  /** `init.headers` tal como lo pasa la ruta (objeto plano). */
  headers?: Record<string, string>;
}

interface UpstreamInit {
  status?: number;
  ok?: boolean;
  json?: unknown;
  bodyText?: string;
  headers?: Record<string, string>;
}

/** Respuesta upstream mínima con la superficie que la ruta consume. */
function upstreamResponse(init: UpstreamInit = {}) {
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
  };
}

function fakeRequest(
  url: string,
  headers: Record<string, string> = {}
): Request {
  const normalized = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );
  return {
    url,
    headers: {
      get: (name: string) => normalized.get(name.toLowerCase()) ?? null,
    },
  } as unknown as Request;
}

function searchUrl(query?: string, page?: string): string {
  const url = new URL(BASE_URL);
  if (query !== undefined) url.searchParams.set("query", query);
  if (page !== undefined) url.searchParams.set("page", page);
  return url.toString();
}

async function capture(
  responsePromise: Promise<unknown>
): Promise<CapturedResponse> {
  return (await responsePromise) as unknown as CapturedResponse;
}

type RouteHandler = (req: Request) => Promise<unknown>;

/** `vi.resetModules()` deja la ruta sin estado compartido entre tests. */
async function loadRoute(): Promise<{ GET: RouteHandler }> {
  vi.resetModules();
  return (await import("../../app/api/unsplash/search/route")) as {
    GET: RouteHandler;
  };
}

function upstreamUrlFrom(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(String(fetchMock.mock.calls[0][0]));
}

const RATE_LIMIT_MESSAGE =
  "Demasiadas búsquedas seguidas. Espera unos segundos e intenta de nuevo.";
const UPSTREAM_403_MESSAGE =
  "Se alcanzó el límite de búsquedas de Unsplash. Intenta de nuevo en unos minutos.";
const UPSTREAM_COOLDOWN_MESSAGE =
  "Búsqueda no disponible temporalmente por límite de Unsplash. Intenta de nuevo en unos minutos.";

describe("GET /api/unsplash/search (caracterización US-12, pre-refactor)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("UNSPLASH_ACCESS_KEY", ACCESS_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    consoleErrorSpy.mockRestore();
  });

  it("sin parámetro query responde 400 missing_query y no llama a fetch", async () => {
    // Aunque no haya key configurada, gana el chequeo de query: el orden real es
    // query → rate limit → key.
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl())));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "missing_query" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("query vacío o solo espacios responde 400 missing_query y no llama a fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const empty = await capture(GET(fakeRequest(searchUrl(""))));
    const blank = await capture(GET(fakeRequest(searchUrl("   "))));

    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: "missing_query" });
    expect(blank.status).toBe(400);
    expect(blank.body).toEqual({ error: "missing_query" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin UNSPLASH_ACCESS_KEY responde 501 missing_key con el aviso exacto y no llama a fetch", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("gatos"))));

    expect(response.status).toBe(501);
    expect(response.body).toEqual({
      error: "missing_key",
      message:
        "Falta configurar UNSPLASH_ACCESS_KEY en .env.local (crea una app gratis en https://unsplash.com/developers)",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("CARACTERIZACIÓN: el rate limit por IP corre antes que la key (con key vacía: 30 avisos 501 y el 31.º 429)", async () => {
    // La ruta incrementa el contador de IP ANTES de comprobar la key; tras 30
    // peticiones sin key el rate limit bloquea con 429 en vez de devolver 501.
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();
    const request = () =>
      fakeRequest(searchUrl("q"), { "x-forwarded-for": "203.0.113.9" });

    const responses: CapturedResponse[] = [];
    for (let index = 0; index < 31; index += 1) {
      responses.push(await capture(GET(request())));
    }

    expect(responses.slice(0, 30).map((response) => response.status)).toEqual(
      Array.from({ length: 30 }, () => 501)
    );
    expect(responses[30].status).toBe(429);
    expect(responses[30].body).toEqual({
      error: "rate_limited",
      message: RATE_LIMIT_MESSAGE,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea las fotos al DTO exacto, arma la URL upstream correcta y responde 200 X-Cache MISS", async () => {
    const upstreamData = {
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
          // Sin `regular`/`small` cae a `full`/`thumb`; sin `alt_description`
          // cae a `description`; sin user cae a "".
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
          // Sin alt ni description cae al query ya recortado (con espacios internos).
          id: "photo-3",
          urls: { regular: "https://images.unsplash.com/regular-3.jpg" },
          alt_description: "",
          description: null,
          user: { name: "", links: {} },
        },
      ],
    };
    const fetchMock = vi.fn(async () => upstreamResponse({ json: upstreamData }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("  Foo   Bar "))));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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
    // Las claves del DTO son siempre las seis, aunque `thumb` quede undefined.
    expect(Object.keys(response.body.results[2])).toEqual([
      "id",
      "url",
      "thumb",
      "alt",
      "author",
      "authorLink",
    ]);
    expect(response.headers).toEqual({ "X-Cache": "MISS" });

    const calledUrl = upstreamUrlFrom(fetchMock);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      "https://api.unsplash.com/search/photos"
    );
    expect(calledUrl.searchParams.get("query")).toBe("Foo   Bar");
    expect(calledUrl.searchParams.get("page")).toBe("1");
    expect(calledUrl.searchParams.get("per_page")).toBe("24");
    expect(calledUrl.searchParams.get("orientation")).toBe("landscape");
    expect(calledUrl.searchParams.get("content_filter")).toBe("high");
    expect(fetchMock).toHaveBeenCalledWith(calledUrl.toString(), {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
      cache: "no-store",
    });
  });

  it("sin total_pages en la respuesta upstream usa 1", async () => {
    const fetchMock = vi.fn(async () =>
      upstreamResponse({ json: { results: [] } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("gatos"))));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ results: [], page: 1, totalPages: 1 });
  });

  it("dos búsquedas equivalentes (mayúsculas/espacios) comparten caché: X-Cache HIT y un solo fetch", async () => {
    const fetchMock = vi.fn(async () =>
      upstreamResponse({
        json: {
          total_pages: 2,
          results: [
            {
              id: "p1",
              urls: { regular: "https://images.unsplash.com/p1.jpg" },
              alt_description: "foto",
              user: null,
            },
          ],
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const first = await capture(GET(fakeRequest(searchUrl("  Foo   Bar "))));
    const second = await capture(GET(fakeRequest(searchUrl("foo bar"))));

    expect(first.status).toBe(200);
    expect(first.headers).toEqual({ "X-Cache": "MISS" });
    expect(second.status).toBe(200);
    expect(second.headers).toEqual({ "X-Cache": "HIT" });
    expect(second.body).toEqual(first.body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("la caché expira a las 24 h: la misma búsqueda vuelve a pedir al upstream (X-Cache MISS)", async () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-04-01T00:00:00.000Z").getTime();
    vi.setSystemTime(t0);
    const fetchMock = vi.fn(async () => upstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const first = await capture(GET(fakeRequest(searchUrl("gatos"))));
    // 1 ms más allá del TTL de 24 h (la comparación usa `>`).
    vi.setSystemTime(t0 + 24 * 60 * 60 * 1000 + 1);
    const second = await capture(GET(fakeRequest(searchUrl("gatos"))));

    expect(first.headers).toEqual({ "X-Cache": "MISS" });
    expect(second.headers).toEqual({ "X-Cache": "MISS" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("CARACTERIZACIÓN: page=0 se normaliza a 1 upstream", async () => {
    const fetchMock = vi.fn(async () => upstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("gatos", "0"))));

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
    expect(upstreamUrlFrom(fetchMock).searchParams.get("page")).toBe("1");
  });

  it("CARACTERIZACIÓN: un page no numérico se normaliza a 1 upstream", async () => {
    const fetchMock = vi.fn(async () => upstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("gatos", "abc"))));

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
    expect(upstreamUrlFrom(fetchMock).searchParams.get("page")).toBe("1");
  });

  it("un page válido se pasa tal cual al upstream y al payload", async () => {
    const fetchMock = vi.fn(async () => upstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("gatos", "3"))));

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(3);
    expect(upstreamUrlFrom(fetchMock).searchParams.get("page")).toBe("3");
  });

  it("la petición 31 de una IP en 60 s responde 429 con Retry-After 120 y deja de llamar a fetch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
    const fetchMock = vi.fn(async () => upstreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    let last: CapturedResponse | undefined;
    for (let index = 0; index < 31; index += 1) {
      last = await capture(
        GET(
          fakeRequest(searchUrl(`q-${index}`), {
            "x-forwarded-for": "198.51.100.23",
          })
        )
      );
    }

    expect(fetchMock).toHaveBeenCalledTimes(30);
    expect(last!.status).toBe(429);
    expect(last!.body).toEqual({
      error: "rate_limited",
      message: RATE_LIMIT_MESSAGE,
    });
    expect(last!.headers).toEqual({ "Retry-After": "120" });
  });

  it("un 403 del upstream responde 429 con el aviso de límite y activa un cooldown de 2 min", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
    const fetchMock = vi.fn(async () => upstreamResponse({ status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const first = await capture(GET(fakeRequest(searchUrl("gatos"))));
    const second = await capture(GET(fakeRequest(searchUrl("perros"))));

    expect(first.status).toBe(429);
    expect(first.body).toEqual({
      error: "rate_limited",
      message: UPSTREAM_403_MESSAGE,
    });
    expect(first.headers).toEqual({ "Retry-After": "120" });

    // Dentro del cooldown no se vuelve a llamar al upstream.
    expect(second.status).toBe(429);
    expect(second.body).toEqual({
      error: "rate_limited",
      message: UPSTREAM_COOLDOWN_MESSAGE,
    });
    expect(second.headers).toEqual({ "Retry-After": "120" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un status no-ok del upstream responde 502 unsplash_error con el status original", async () => {
    const fetchMock = vi.fn(async () =>
      upstreamResponse({ status: 500, bodyText: "boom" })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("gatos"))));

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: "unsplash_error", status: 500 });
  });

  it("x-ratelimit-remaining: 0 activa el cooldown: la siguiente búsqueda responde 429 sin llamar a fetch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
    const fetchMock = vi.fn(async () =>
      upstreamResponse({
        json: { results: [], total_pages: 1 },
        headers: { "x-ratelimit-remaining": "0" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const first = await capture(GET(fakeRequest(searchUrl("gatos"))));
    const second = await capture(GET(fakeRequest(searchUrl("perros"))));

    // La primera respuesta sigue siendo 200 (el header se procesa antes de
    // devolver el payload) y solo la siguiente entra en cooldown.
    expect(first.status).toBe(200);
    expect(first.headers).toEqual({ "X-Cache": "MISS" });
    expect(second.status).toBe(429);
    expect(second.body).toEqual({
      error: "rate_limited",
      message: UPSTREAM_COOLDOWN_MESSAGE,
    });
    expect(second.headers).toEqual({ "Retry-After": "120" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("CARACTERIZACIÓN: un remaining bajo pero mayor que 0 no bloquea (la rama de aviso está vacía)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
    const fetchMock = vi.fn(async () =>
      upstreamResponse({
        json: { results: [], total_pages: 1 },
        headers: { "x-ratelimit-remaining": "5" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const first = await capture(GET(fakeRequest(searchUrl("gatos"))));
    const second = await capture(GET(fakeRequest(searchUrl("perros"))));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers).toEqual({ "X-Cache": "MISS" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("si fetch rechaza responde 500 internal_error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fallo de red");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await capture(GET(fakeRequest(searchUrl("gatos"))));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "internal_error" });
  });

  it("la key nunca aparece en logs ni en bodies de error (403, no-ok y rechazo de fetch)", async () => {
    // 403
    let { GET } = await loadRoute();
    let fetchMock = vi.fn(async () => upstreamResponse({ status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const forbidden = await capture(GET(fakeRequest(searchUrl("gatos"))));
    expect(JSON.stringify(forbidden.body)).not.toContain(ACCESS_KEY);

    // Upstream no-ok
    ({ GET } = await loadRoute());
    fetchMock = vi.fn(async () =>
      upstreamResponse({ status: 500, bodyText: "detalle interno" })
    );
    vi.stubGlobal("fetch", fetchMock);
    const upstreamError = await capture(GET(fakeRequest(searchUrl("gatos"))));
    expect(JSON.stringify(upstreamError.body)).not.toContain(ACCESS_KEY);

    // fetch rechaza
    ({ GET } = await loadRoute());
    fetchMock = vi.fn(async () => {
      throw new Error("fallo de red");
    });
    vi.stubGlobal("fetch", fetchMock);
    const internalError = await capture(GET(fakeRequest(searchUrl("gatos"))));
    expect(JSON.stringify(internalError.body)).not.toContain(ACCESS_KEY);

    // Hubo logs (la ruta loguea los tres caminos) y ninguno filtra la key.
    expect(consoleErrorSpy).toHaveBeenCalled();
    for (const call of consoleErrorSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(ACCESS_KEY);
    }
  });
});
