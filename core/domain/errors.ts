export type DomainErrorCode = "NOT_FOUND" | "CONFLICT" | "VALIDATION";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super("NOT_FOUND", message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("VALIDATION", message);
  }
}

/**
 * US-12 (U2): subclase de conflicto para el 403 legacy de "Game entry is
 * locked". El mapper genérico sigue dando 400 (code CONFLICT); el override a
 * 403 lo hace la ruta de join.
 */
export class GameLockedError extends ConflictError {}
