import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody } from "@/adapters/http/schemas/parse-body";
import { ValidationError } from "@/core/domain/errors";

// US-12 (§9): `parseBody` nunca propaga `ZodError`; todo fallo se traduce al
// mensaje legacy de la ruta en un `ValidationError`.

const schema = z.object({ name: z.string() });

function validationError(run: () => unknown): ValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) return error;
    throw error;
  }
  throw new Error("Se esperaba un ValidationError");
}

describe("adapters/http/schemas/parse-body", () => {
  it("un raw válido devuelve los datos tipados", () => {
    expect(parseBody(schema, { name: "Quiz" }, "mensaje legacy")).toEqual({
      name: "Quiz",
    });
  });

  it("un raw inválido lanza ValidationError con el mensaje legacy exacto", () => {
    const error = validationError(() =>
      parseBody(schema, { name: 42 }, "mensaje legacy")
    );

    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "mensaje legacy",
    });
  });

  it("nunca propaga el ZodError crudo", () => {
    const error = validationError(() => parseBody(schema, null, "otro mensaje"));

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.name).toBe("ValidationError");
  });
});
