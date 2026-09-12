import type {
  ImageSearchCache,
  ImageSearchGateway,
  ImageSearchPayload,
  IpRateLimiter,
} from "../ports/image-search";

// US-12 §4: caso de uso SearchImages. Acá vive el ORDEN caracterizado de la
// ruta legacy: rate limit por IP → credenciales → caché → gateway. El core no
// ve fetch/env/Date.now; solo los puertos.

export interface SearchImagesInput {
  /** Ya trimmeado por el borde (paridad con `query?.trim()`). */
  query: string;
  page: number;
  ip: string;
}

export interface SearchImagesDeps {
  gateway: ImageSearchGateway;
  cache: ImageSearchCache;
  rateLimiter: IpRateLimiter;
}

export type SearchImagesOutcome =
  | { kind: "ok"; payload: ImageSearchPayload; cache: "HIT" | "MISS" }
  | { kind: "rate_limited_ip" }
  | { kind: "missing_credentials" }
  | { kind: "provider_rate_limited" }
  | { kind: "provider_cooldown" }
  | { kind: "provider_error"; status: number };

export interface SearchImagesUseCase {
  execute(input: SearchImagesInput): Promise<SearchImagesOutcome>;
}

/** Misma clave que el legacy: query normalizada + page. */
export function imageSearchCacheKey(query: string, page: number): string {
  return `${query.toLowerCase().replace(/\s+/g, " ").trim()}|${page}`;
}

export function createSearchImagesUseCase(
  deps: SearchImagesDeps
): SearchImagesUseCase {
  return {
    async execute(input) {
      // ORDEN EXACTO caracterizado (§4). No reordenar.
      if (deps.rateLimiter.hit(input.ip)) return { kind: "rate_limited_ip" };
      if (!deps.gateway.hasCredentials()) return { kind: "missing_credentials" };

      const key = imageSearchCacheKey(input.query, input.page);
      const cached = deps.cache.get(key);
      if (cached) return { kind: "ok", payload: cached, cache: "HIT" };

      const result = await deps.gateway.search({
        query: input.query,
        page: input.page,
      });
      switch (result.kind) {
        case "ok":
          deps.cache.set(key, result.payload);
          return { kind: "ok", payload: result.payload, cache: "MISS" };
        case "provider_rate_limited":
          return { kind: "provider_rate_limited" };
        case "provider_cooldown":
          return { kind: "provider_cooldown" };
        case "provider_error":
          return { kind: "provider_error", status: result.status };
      }
    },
  };
}
