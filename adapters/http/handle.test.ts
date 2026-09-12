import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handle } from "@/adapters/http/handle";
import { ok } from "@/adapters/http/next-response";
import {
  ConflictError,
  GameLockedError,
  NotFoundError,
} from "@/core/domain/errors";

// US-12 (U1): el helper `handle` mapea errores a la respuesta `{ error }` del
// contrato legacy. A diferencia de las rutas, acá se usa el `NextResponse` REAL
// (patrón de `next-response.test.ts`) para fijar status y body.

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("adapters/http/handle", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("run OK devuelve la respuesta tal cual", async () => {
    const response = await handle(
      async () => ok({ game: { id: "123456" } }, 201),
      "Error creating game:"
    );

    expect(response.status).toBe(201);
    expect(await json(response)).toEqual({ game: { id: "123456" } });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("DomainError usa status/mensaje del mapper y NO loguea (paridad con el legacy)", async () => {
    const response = await handle(async () => {
      throw new NotFoundError("Game not found");
    }, "Error fetching game:");

    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ error: "Game not found" });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("Error crudo responde 500 Internal server error y loguea el mensaje de la ruta con la causa", async () => {
    const cause = new Error("fallo de mongo");

    const response = await handle(async () => {
      throw cause;
    }, "Error creating game:");

    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({ error: "Internal server error" });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error creating game:", {
      name: "Error",
      message: "fallo de mongo",
      stack: cause.stack,
    });
  });

  it("GameLockedError sigue mapeando 400 por código CONFLICT (el 403 es override de la ruta de join)", async () => {
    const response = await handle(async () => {
      throw new GameLockedError("Game entry is locked");
    }, "Error joining game:");

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ error: "Game entry is locked" });
    // La subclase no altera el mapeo genérico.
    expect(new GameLockedError("Game entry is locked")).toBeInstanceOf(
      ConflictError
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
