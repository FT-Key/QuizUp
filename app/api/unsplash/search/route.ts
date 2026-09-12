import { NextResponse } from "next/server";
import { ok } from "@/adapters/http/next-response";
import { getContainer } from "@/infra/container";
import { toSafeLogDetail } from "@/lib/log-redact";

// US-12 §4: adaptador HTTP fino de Unsplash. Parse literal de query/page
// (caracterizado: sin Zod), IP por headers y despacho al caso de uso; el estado
// (caché/rate limit/cooldown) vive en las instancias del container. Los shapes
// 429/501/502/500 especiales se conservan byte a byte.

export const dynamic = "force-dynamic";

const RETRY_AFTER = { "Retry-After": "120" };
const MESSAGES = {
  rateLimited:
    "Demasiadas búsquedas seguidas. Espera unos segundos e intenta de nuevo.",
  missingKey:
    "Falta configurar UNSPLASH_ACCESS_KEY en .env.local (crea una app gratis en https://unsplash.com/developers)",
  providerLimit:
    "Se alcanzó el límite de búsquedas de Unsplash. Intenta de nuevo en unos minutos.",
  cooldown:
    "Búsqueda no disponible temporalmente por límite de Unsplash. Intenta de nuevo en unos minutos.",
} as const;

function rateLimited(message: string): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", message },
    { status: 429, headers: RETRY_AFTER }
  );
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    if (!query) return NextResponse.json({ error: "missing_query" }, { status: 400 });

    const outcome = await getContainer().useCases.searchImages.execute({
      query,
      page,
      ip: clientIp(request),
    });

    switch (outcome.kind) {
      case "ok":
        return ok(outcome.payload, 200, { "X-Cache": outcome.cache });
      case "missing_credentials":
        return NextResponse.json(
          { error: "missing_key", message: MESSAGES.missingKey },
          { status: 501 }
        );
      case "rate_limited_ip":
        return rateLimited(MESSAGES.rateLimited);
      case "provider_rate_limited":
        return rateLimited(MESSAGES.providerLimit);
      case "provider_cooldown":
        return rateLimited(MESSAGES.cooldown);
      case "provider_error":
        return NextResponse.json(
          { error: "unsplash_error", status: outcome.status },
          { status: 502 }
        );
    }
  } catch (cause) {
    console.error("Error searching Unsplash:", toSafeLogDetail(cause));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
