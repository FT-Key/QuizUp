import type { Clock } from "@/core/application/ports/clock";
import type {
  ImageSearchGateway,
  ImageSearchGatewayResult,
} from "@/core/application/ports/image-search";
import type { Logger } from "@/core/application/ports/logger";

// US-12 §4: adaptador HTTP de Unsplash. Traduce la API del proveedor al puerto
// `ImageSearchGateway`: la key vive SOLO acá (config por constructor), el core
// únicamente ve `hasCredentials()`. El cooldown de 2 min es estado de instancia.

const PER_PAGE = 24;
const UPSTREAM_BLOCK_COOLDOWN_MS = 2 * 60 * 1000;

/** Subconjunto tipado de la respuesta upstream que se consume. */
interface UnsplashPhoto {
  id: string;
  urls?: { regular?: string; full?: string; small?: string; thumb?: string };
  alt_description?: string | null;
  description?: string | null;
  user?: { name?: string; links?: { html?: string } } | null;
}

export interface UnsplashHttpAdapterDeps {
  accessKey: string | null;
  clock: Clock;
  logger: Logger;
  fetch: typeof fetch;
}

export function createUnsplashSearchGateway(
  deps: UnsplashHttpAdapterDeps
): ImageSearchGateway {
  // Estado del cooldown. El legacy además guardaba `remaining`, muerto: no se porta.
  let blockedUntil = 0;

  return {
    hasCredentials: () => deps.accessKey !== null,

    async search({ query, page }): Promise<ImageSearchGatewayResult> {
      if (deps.clock.now() < blockedUntil) return { kind: "provider_cooldown" };

      const accessKey = deps.accessKey;
      if (!accessKey) throw new Error("Unsplash access key is not configured");

      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(PER_PAGE));
      url.searchParams.set("orientation", "landscape");
      url.searchParams.set("content_filter", "high");

      const res = await deps.fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${accessKey}` },
        cache: "no-store",
      });

      if (res.status === 403) {
        deps.logger.error("[unsplash] límite de búsquedas alcanzado (403)");
        blockedUntil = deps.clock.now() + UPSTREAM_BLOCK_COOLDOWN_MS;
        return { kind: "provider_rate_limited" };
      }

      if (!res.ok) {
        // best-effort: sin cuerpo del error si la lectura falla
        const detail = await res.text().catch(() => "");
        deps.logger.error("[unsplash] error", { status: res.status, detail });
        return { kind: "provider_error", status: res.status };
      }

      const remainingHeader = res.headers.get("x-ratelimit-remaining");
      if (remainingHeader !== null) {
        const remaining = Number.parseInt(remainingHeader, 10);
        if (!Number.isNaN(remaining) && remaining === 0) {
          blockedUntil = deps.clock.now() + UPSTREAM_BLOCK_COOLDOWN_MS;
        }
        // `remaining <= 10` era una rama vacía en el legacy: no se porta.
      }

      const data = (await res.json()) as {
        results?: UnsplashPhoto[];
        total_pages?: number;
      };
      return {
        kind: "ok",
        payload: {
          // URL/alt vacíos inválidos: se conserva `||` en los fallbacks de campos.
          results: (data.results ?? []).map((photo) => ({
            id: photo.id,
            url: photo.urls?.regular || photo.urls?.full || "",
            thumb: photo.urls?.small || photo.urls?.thumb,
            alt: photo.alt_description || photo.description || query,
            author: photo.user?.name || "",
            authorLink: photo.user?.links?.html || "",
          })),
          page,
          totalPages: data.total_pages ?? 1,
        },
      };
    },
  };
}
