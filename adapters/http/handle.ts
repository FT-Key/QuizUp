import type { NextResponse } from "next/server";
import { DomainError } from "@/core/domain/errors";
import { toHttpError } from "./error-mapper";
import { error } from "./next-response";

/**
 * Envuelve un handler de juego: `parse → use case → ok/error`.
 * - `DomainError` → status/mensaje del mapper, SIN log (el legacy no logueaba 4xx).
 * - Error crudo → 500 `{ error: "Internal server error" }` + `console.error(logMessage, cause)`.
 * No usar en Unsplash: sus shapes 429/501/502/500 especiales no son `{error:string}`.
 */
export async function handle(
  run: () => Promise<NextResponse>,
  logMessage: string
): Promise<NextResponse> {
  try {
    return await run();
  } catch (cause) {
    if (!(cause instanceof DomainError)) {
      console.error(logMessage, cause);
    }
    const mapped = toHttpError(cause);
    return error(mapped.message, mapped.status);
  }
}
