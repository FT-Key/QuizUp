import { describe, expect, it } from "vitest";
import type {
  ImageSearchCache,
  ImageSearchGateway,
  ImageSearchGatewayResult,
  ImageSearchPayload,
  IpRateLimiter,
} from "@/core/application/ports/image-search";
import {
  createSearchImagesUseCase,
  imageSearchCacheKey,
} from "@/core/application/use-cases/search-images";

// US-12 §6: el caso de uso fija el ORDEN caracterizado (rate limit → key →
// caché → gateway) y la semántica de cada outcome. Los fakes registran las
// llamadas para detectar reordenamientos.

const PAYLOAD: ImageSearchPayload = {
  results: [
    {
      id: "p1",
      url: "https://images.unsplash.com/p1.jpg",
      alt: "foto",
      author: "Ana",
      authorLink: "https://unsplash.com/@ana",
    },
  ],
  page: 2,
  totalPages: 2,
};

interface RecordingOptions {
  hasCredentials?: boolean;
  rateLimited?: boolean;
  cached?: ImageSearchPayload | null;
  gatewayResult?: ImageSearchGatewayResult;
  rejectWith?: Error;
}

interface RecordingDeps {
  order: string[];
  sets: Array<{ key: string; payload: ImageSearchPayload }>;
  gateway: ImageSearchGateway;
  cache: ImageSearchCache;
  rateLimiter: IpRateLimiter;
}

function recordingDeps(options: RecordingOptions = {}): RecordingDeps {
  const order: string[] = [];
  const sets: RecordingDeps["sets"] = [];
  const gateway: ImageSearchGateway = {
    hasCredentials: () => {
      order.push("credentials");
      return options.hasCredentials ?? true;
    },
    search: async ({ query, page }) => {
      order.push(`search:${query}:${page}`);
      if (options.rejectWith) throw options.rejectWith;
      return options.gatewayResult ?? { kind: "ok", payload: PAYLOAD };
    },
  };
  const cache: ImageSearchCache = {
    get: (key) => {
      order.push(`cache.get:${key}`);
      return options.cached ?? null;
    },
    set: (key, payload) => {
      order.push(`cache.set:${key}`);
      sets.push({ key, payload });
    },
  };
  const rateLimiter: IpRateLimiter = {
    hit: (ip) => {
      order.push(`rate:${ip}`);
      return options.rateLimited ?? false;
    },
  };
  return { order, sets, gateway, cache, rateLimiter };
}

describe("core/application/use-cases/search-images", () => {
  it("el rate limit por IP corre primero y corta el flujo", async () => {
    const deps = recordingDeps({ rateLimited: true });
    const useCase = createSearchImagesUseCase(deps);

    const outcome = await useCase.execute({
      query: "gatos",
      page: 1,
      ip: "1.2.3.4",
    });

    expect(outcome).toEqual({ kind: "rate_limited_ip" });
    expect(deps.order).toEqual(["rate:1.2.3.4"]);
  });

  it("hasCredentials corre después del rate limit y antes de la caché", async () => {
    const deps = recordingDeps({ hasCredentials: false });
    const useCase = createSearchImagesUseCase(deps);

    const outcome = await useCase.execute({
      query: "gatos",
      page: 1,
      ip: "1.2.3.4",
    });

    expect(outcome).toEqual({ kind: "missing_credentials" });
    expect(deps.order).toEqual(["rate:1.2.3.4", "credentials"]);
  });

  it("con caché HIT responde sin llamar al gateway ni re-cachear", async () => {
    const deps = recordingDeps({ cached: PAYLOAD });
    const useCase = createSearchImagesUseCase(deps);

    const outcome = await useCase.execute({
      query: "Foo   Bar",
      page: 2,
      ip: "ip",
    });

    expect(outcome).toEqual({ kind: "ok", payload: PAYLOAD, cache: "HIT" });
    expect(deps.order).toEqual([
      "rate:ip",
      "credentials",
      "cache.get:foo bar|2",
    ]);
    expect(deps.sets).toEqual([]);
  });

  it("en MISS llama al gateway con query/page exactos y cachea el payload", async () => {
    const deps = recordingDeps();
    const useCase = createSearchImagesUseCase(deps);

    const outcome = await useCase.execute({
      query: "Foo   Bar",
      page: 2,
      ip: "ip",
    });

    expect(outcome).toEqual({ kind: "ok", payload: PAYLOAD, cache: "MISS" });
    expect(deps.order).toEqual([
      "rate:ip",
      "credentials",
      "cache.get:foo bar|2",
      "search:Foo   Bar:2",
      "cache.set:foo bar|2",
    ]);
    expect(deps.sets).toEqual([{ key: "foo bar|2", payload: PAYLOAD }]);
  });

  it("cada fallo del gateway se propaga tal cual, sin tocar la caché", async () => {
    const results: ImageSearchGatewayResult[] = [
      { kind: "provider_rate_limited" },
      { kind: "provider_cooldown" },
      { kind: "provider_error", status: 503 },
    ];

    for (const gatewayResult of results) {
      const deps = recordingDeps({ gatewayResult });
      const useCase = createSearchImagesUseCase(deps);

      const outcome = await useCase.execute({
        query: "gatos",
        page: 1,
        ip: "ip",
      });

      expect(outcome).toEqual(gatewayResult);
      expect(deps.sets).toEqual([]);
    }
  });

  it("un rechazo inesperado del gateway se propaga (la ruta lo mapea a 500)", async () => {
    const deps = recordingDeps({ rejectWith: new Error("fallo de red") });
    const useCase = createSearchImagesUseCase(deps);

    await expect(
      useCase.execute({ query: "gatos", page: 1, ip: "ip" })
    ).rejects.toThrow("fallo de red");
    expect(deps.sets).toEqual([]);
  });

  it("imageSearchCacheKey normaliza mayúsculas y espacios (misma clave que el legacy)", () => {
    expect(imageSearchCacheKey("  Foo   Bar ", 3)).toBe("foo bar|3");
    expect(imageSearchCacheKey("FOO BAR", 3)).toBe("foo bar|3");
    expect(imageSearchCacheKey("a\tb\nc", 1)).toBe("a b c|1");
    expect(imageSearchCacheKey("gatos", 1)).not.toBe(
      imageSearchCacheKey("gatos", 2)
    );
  });
});
