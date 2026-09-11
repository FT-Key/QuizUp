import { describe, expect, it } from "vitest";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from "@/core/domain/errors";

// US-09: caracteriza la jerarquía de errores de dominio compartida con el
// kernel del WS (mismos códigos) antes de que la usen mapper y rutas.

describe("core/domain/errors", () => {
  it("NotFoundError es DomainError/Error con code NOT_FOUND", () => {
    const error = new NotFoundError("x");

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.name).toBe("NotFoundError");
    expect(error.message).toBe("x");
  });

  it("ConflictError usa el código CONFLICT", () => {
    const error = new ConflictError("y");

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("CONFLICT");
    expect(error.name).toBe("ConflictError");
    expect(error.message).toBe("y");
  });

  it("ValidationError usa el código VALIDATION", () => {
    const error = new ValidationError("z");

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("VALIDATION");
    expect(error.name).toBe("ValidationError");
    expect(error.message).toBe("z");
  });
});
