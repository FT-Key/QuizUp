/**
 * US-17 (BL-16) — `log-redact`: proyección segura de `cause` para logs.
 *
 * Congela la redacción de URIs de Mongo (con credenciales) y la forma del
 * detalle de un `Error` (sin props adjuntas), sin acoplarse al logger.
 */
import { describe, expect, it } from "vitest";
import { redactSecrets, toSafeLogDetail } from "@/lib/log-redact";

const SRV_URI =
  "mongodb+srv://user:secret@cluster0.mongodb.net/db?retryWrites=true";
const PLAIN_URI = "mongodb://user:secret@localhost:27017/db";

describe("redactSecrets", () => {
  it("redacta una URI mongodb+srv sin dejar credenciales", () => {
    const out = redactSecrets(`failed to connect: ${SRV_URI}`);

    expect(out).not.toContain("secret");
    expect(out).not.toContain("cluster0.mongodb.net");
    expect(out).toBe("failed to connect: [redacted-mongodb-uri]");
  });

  it("redacta también mongodb:// sin +srv", () => {
    expect(redactSecrets(PLAIN_URI)).toBe("[redacted-mongodb-uri]");
  });

  it("no altera mensajes normales", () => {
    expect(redactSecrets("game not found")).toBe("game not found");
  });
});

describe("toSafeLogDetail", () => {
  it("proyecta un Error a { name, message, stack } con secretos redactados", () => {
    const error = new Error(`connect ECONNREFUSED ${SRV_URI}`);
    error.stack = `Error: connect ECONNREFUSED ${SRV_URI}\n    at connect`;

    expect(toSafeLogDetail(error)).toEqual({
      name: "Error",
      message: "connect ECONNREFUSED [redacted-mongodb-uri]",
      stack: "Error: connect ECONNREFUSED [redacted-mongodb-uri]\n    at connect",
    });
  });

  it("no incluye propiedades adjuntas del Error", () => {
    const error = Object.assign(new Error("boom"), { secret: "leak" });

    const detail = toSafeLogDetail(error) as Record<string, unknown>;
    expect(detail).not.toHaveProperty("secret");
    expect(Object.keys(detail).sort()).toEqual(["message", "name", "stack"]);
  });

  it("un Error sin stack omite la clave stack", () => {
    const error = new Error("boom");
    delete (error as { stack?: string }).stack;

    expect(toSafeLogDetail(error)).toEqual({ name: "Error", message: "boom" });
  });

  it("un no-Error devuelve el string redactado", () => {
    expect(toSafeLogDetail(42)).toBe("42");
    expect(toSafeLogDetail(`cfg ${PLAIN_URI}`)).toBe(
      "cfg [redacted-mongodb-uri]"
    );
  });
});
