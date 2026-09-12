import { describe, expect, it } from "vitest";
import { HTTP_STATUS_BY_CODE, toHttpError } from "@/adapters/http/error-mapper";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/core/domain/errors";

// US-09: congela la tabla DomainErrorCode → status del contrato v1.0.0.
// CONFLICT mapea 400 (no 409) porque ninguna ruta legacy usa 409 y los 20
// tests de caracterización de errores así lo congelan.

describe("adapters/http/error-mapper", () => {
  it("NotFoundError ⇒ 404 con el mensaje intacto", () => {
    expect(toHttpError(new NotFoundError("Game not found"))).toEqual({
      status: 404,
      message: "Game not found",
    });
  });

  it("ValidationError ⇒ 400", () => {
    expect(toHttpError(new ValidationError("Invalid JSON body"))).toEqual({
      status: 400,
      message: "Invalid JSON body",
    });
  });

  it("ConflictError ⇒ 400 (no 409)", () => {
    expect(
      toHttpError(new ConflictError("Player name is already taken in this game"))
    ).toEqual({
      status: 400,
      message: "Player name is already taken in this game",
    });
  });

  it("Error crudo ⇒ 500 genérico sin filtrar el mensaje", () => {
    expect(toHttpError(new Error("boom"))).toEqual({
      status: 500,
      message: "Internal server error",
    });
  });

  it("string suelto ⇒ 500 genérico (Δ3 US-18: sin canal de fuga)", () => {
    expect(toHttpError("Invalid JSON body")).toEqual({
      status: 500,
      message: "Internal server error",
    });
  });

  it("undefined/null ⇒ 500 genérico y la tabla exportada es exacta", () => {
    expect(toHttpError(undefined)).toEqual({
      status: 500,
      message: "Internal server error",
    });
    expect(toHttpError(null)).toEqual({
      status: 500,
      message: "Internal server error",
    });
    expect(HTTP_STATUS_BY_CODE).toEqual({
      NOT_FOUND: 404,
      VALIDATION: 400,
      CONFLICT: 400,
    });
  });
});
