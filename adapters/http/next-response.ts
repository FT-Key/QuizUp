import { NextResponse } from "next/server";
import type { DomainError } from "@/core/domain/errors";
import { toHttpError } from "./error-mapper";

/** Respuesta OK con el shape tal cual del contrato (200 por defecto). */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Respuesta de error con shape exacto `{ error: string }`. */
export function error(payload: string | DomainError, statusOverride?: number): NextResponse {
  const mapped = toHttpError(payload);
  return NextResponse.json(
    { error: mapped.message },
    { status: statusOverride ?? mapped.status }
  );
}
