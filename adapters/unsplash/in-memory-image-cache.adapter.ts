import type { Clock } from "@/core/application/ports/clock";
import type {
  ImageSearchCache,
  ImageSearchPayload,
} from "@/core/application/ports/image-search";

// US-12 §2.1: caché en memoria con la semántica exacta del legacy (ruta
// Unsplash pre-refactor): TTL por entrada, `now > expiresAt` descarta, `get`
// hace touch LRU (delete + set) y `set` expulsa la clave más antigua cuando
// se alcanza el tope.

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 200;

export interface InMemoryImageCacheDeps {
  clock: Clock;
  ttlMs?: number; // default 24 h
  maxEntries?: number; // default 200
}

interface CacheEntry {
  payload: ImageSearchPayload;
  expiresAt: number;
}

export function createInMemoryImageCache(
  deps: InMemoryImageCacheDeps
): ImageSearchCache {
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = deps.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const entries = new Map<string, CacheEntry>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (deps.clock.now() > entry.expiresAt) {
        entries.delete(key);
        return null;
      }

      // Touch LRU: la clave vuelve al final del orden de inserción.
      entries.delete(key);
      entries.set(key, entry);
      return entry.payload;
    },

    set(key, payload) {
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key, { payload, expiresAt: deps.clock.now() + ttlMs });
    },
  };
}
