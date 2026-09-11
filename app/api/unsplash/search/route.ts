import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PER_PAGE = 24;




const CACHE_TTL_MS = 24 * 60 * 60 * 1000; 
const MAX_CACHE_ENTRIES = 200;

interface SearchPayload {
  results: Array<{
    id: string;
    url: string;
    thumb: string;
    alt: string;
    author: string;
    authorLink: string;
  }>;
  page: number;
  totalPages: number;
}

const searchCache = new Map<
  string,
  { payload: SearchPayload; expiresAt: number }
>();

function cacheKey(query: string, page: number) {
  return `${query.toLowerCase().replace(/\s+/g, " ").trim()}|${page}`;
}

function getCached(key: string): SearchPayload | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  
  searchCache.delete(key);
  searchCache.set(key, entry);
  return entry.payload;
}

function setCached(key: string, payload: SearchPayload) {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}




const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const MAX_TRACKED_IPS = 1000;

const ipRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipRequests.get(ip) || []).filter(
    (time) => now - time < RATE_LIMIT_WINDOW_MS
  );

  if (hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRequests.set(ip, hits);
    return true;
  }

  hits.push(now);
  if (ipRequests.size >= MAX_TRACKED_IPS && !ipRequests.has(ip)) {
    const oldest = ipRequests.keys().next().value;
    if (oldest !== undefined) ipRequests.delete(oldest);
  }
  ipRequests.set(ip, hits);
  return false;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}





const UPSTREAM_WARN_REMAINING = 10;
const UPSTREAM_BLOCK_COOLDOWN_MS = 2 * 60 * 1000; 

const upstream = {
  remaining: null as number | null,
  blockedUntil: 0,
};

function rateLimitedResponse(message: string) {
  return NextResponse.json(
    { error: "rate_limited", message },
    { status: 429, headers: { "Retry-After": "120" } }
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim();
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") || "1", 10) || 1
    );

    if (!query) {
      return NextResponse.json({ error: "missing_query" }, { status: 400 });
    }

    
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return rateLimitedResponse(
        "Demasiadas búsquedas seguidas. Espera unos segundos e intenta de nuevo."
      );
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      return NextResponse.json(
        {
          error: "missing_key",
          message:
            "Falta configurar UNSPLASH_ACCESS_KEY en .env.local (crea una app gratis en https://unsplash.com/developers)",
        },
        { status: 501 }
      );
    }

    
    const key = cacheKey(query, page);
    const cached = getCached(key);
    if (cached) {
      return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
    }

    
    if (Date.now() < upstream.blockedUntil) {
      return rateLimitedResponse(
        "Búsqueda no disponible temporalmente por límite de Unsplash. Intenta de nuevo en unos minutos."
      );
    }

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
      cache: "no-store",
    });

    
    if (res.status === 403) {
      console.error("[unsplash] límite de búsquedas alcanzado (403)");
      upstream.remaining = 0;
      upstream.blockedUntil = Date.now() + UPSTREAM_BLOCK_COOLDOWN_MS;
      return rateLimitedResponse(
        "Se alcanzó el límite de búsquedas de Unsplash. Intenta de nuevo en unos minutos."
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[unsplash] error", res.status, detail);
      return NextResponse.json(
        { error: "unsplash_error", status: res.status },
        { status: 502 }
      );
    }

    
    const remainingHeader = res.headers.get("x-ratelimit-remaining");
    if (remainingHeader !== null) {
      const remaining = Number.parseInt(remainingHeader, 10);
      if (!Number.isNaN(remaining)) {
        upstream.remaining = remaining;
        if (remaining === 0) {
          upstream.blockedUntil = Date.now() + UPSTREAM_BLOCK_COOLDOWN_MS;
        } else if (remaining <= UPSTREAM_WARN_REMAINING) {
          
        }
      }
    }

    const data = await res.json();
    const results: SearchPayload["results"] = (data.results || []).map(
      (photo: any) => ({
        id: photo.id,
        url: photo.urls?.regular || photo.urls?.full,
        thumb: photo.urls?.small || photo.urls?.thumb,
        alt: photo.alt_description || photo.description || query,
        author: photo.user?.name || "",
        authorLink: photo.user?.links?.html || "",
      })
    );

    const payload: SearchPayload = {
      results,
      page,
      totalPages: data.total_pages ?? 1,
    };

    setCached(key, payload);

    return NextResponse.json(payload, { headers: { "X-Cache": "MISS" } });
  } catch (error) {
    console.error("Error searching Unsplash:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
