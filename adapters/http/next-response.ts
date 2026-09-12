import { NextResponse } from "next/server";
import type { DomainError } from "@/core/domain/errors";
import { toHttpError } from "./error-mapper";

/** Respuesta OK con el shape tal cual del contrato (200 por defecto). */
export function ok<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, { status, headers });
}

/**
 * Respuesta de error con shape exacto `{ error: string }`.
 * El mensaje string del borde (p. ej. "Invalid JSON body") se emite tal cual:
 * es un canal explícito del handler. `toHttpError` solo traduce `DomainError`
 * y oculta el resto como "Internal server error".
 */
export function error(payload: string | DomainError, statusOverride?: number): NextResponse {
  if (typeof payload === "string") {
    return NextResponse.json(
      { error: payload },
      { status: statusOverride ?? 500 }
    );
  }
  const mapped = toHttpError(payload);
  return NextResponse.json(
    { error: mapped.message },
    { status: statusOverride ?? mapped.status }
  );
}
