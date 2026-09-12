import type { Clock } from "@/core/application/ports/clock";
import type { IpRateLimiter } from "@/core/application/ports/image-search";

// US-12 §2.1: ventana deslizante en memoria con la semántica exacta del legacy:
// se filtran los hits dentro de la ventana; si ya alcanzó el tope devuelve
// `true` sin registrar el intento; si no, registra y evicta la IP más antigua
// al llegar a `maxIps`.

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;
const DEFAULT_MAX_IPS = 1000;

export interface InMemoryIpRateLimiterDeps {
  clock: Clock;
  windowMs?: number; // default 60_000
  maxRequests?: number; // default 30
  maxIps?: number; // default 1000
}

export function createInMemoryIpRateLimiter(
  deps: InMemoryIpRateLimiterDeps
): IpRateLimiter {
  const windowMs = deps.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = deps.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const maxIps = deps.maxIps ?? DEFAULT_MAX_IPS;
  const requestsByIp = new Map<string, number[]>();

  return {
    hit(ip) {
      const now = deps.clock.now();
      const hits = (requestsByIp.get(ip) ?? []).filter(
        (time) => now - time < windowMs
      );

      if (hits.length >= maxRequests) {
        requestsByIp.set(ip, hits);
        return true;
      }

      hits.push(now);
      if (requestsByIp.size >= maxIps && !requestsByIp.has(ip)) {
        const oldest = requestsByIp.keys().next().value;
        if (oldest !== undefined) requestsByIp.delete(oldest);
      }
      requestsByIp.set(ip, hits);
      return false;
    },
  };
}
