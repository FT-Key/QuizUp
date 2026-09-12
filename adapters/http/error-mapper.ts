import { DomainError, type DomainErrorCode } from "@/core/domain/errors";

export interface HttpError {
  readonly status: number;
  readonly message: string;
}

/**
 * Tabla canónica DomainErrorCode → status HTTP.
 * El contrato v1.0.0 NO usa 409 en ninguna ruta: todo conflicto legacy
 * (nombre tomado, partida no waiting/active) responde 400.
 */
export const HTTP_STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 400,
};

const INTERNAL_ERROR: HttpError = {
  status: 500,
  message: "Internal server error",
};

/**
 * Mapea un error a `{ status, message }`. Nunca filtra el mensaje de un Error
 * crudo: solo los `DomainError` exponen el suyo; cualquier otro valor (incluidos
 * strings sueltos) responde 500 genérico. Los mensajes string explícitos del
 * borde los emite `error()` en `next-response`.
 */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof DomainError) {
    return { status: HTTP_STATUS_BY_CODE[error.code], message: error.message };
  }
  return INTERNAL_ERROR;
}
