import { describe, expect, it } from "vitest";
import { error, ok } from "@/adapters/http/next-response";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/core/domain/errors";

// US-09 (D4): se usa el `NextResponse` REAL de `next/server` (Node 24 expone
// Request/Response globales). Si Vitest no pudiera cargarlo, el fallback
// documentado es mockear `next/server` con captura de `json(body, init)`.

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("adapters/http/next-response", () => {
  it("ok con 201 conserva el payload y el status", async () => {
    const response = ok({ game: { id: "1" } }, 201);

    expect(response.status).toBe(201);
    expect(await json(response)).toEqual({ game: { id: "1" } });
  });

  it("ok sin status usa 200", async () => {
    const response = ok({ games: [] });

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ games: [] });
  });

  it("error(string, 400) usa shape { error } con una sola clave", async () => {
    const response = error("Invalid JSON body", 400);
    const body = await json<Record<string, unknown>>(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON body" });
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("error(DomainError) mapea 404 para NotFoundError", async () => {
    const response = error(new NotFoundError("Game not found"));

    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ error: "Game not found" });
  });

  it("error(ConflictError) mapea 400, no 409", async () => {
    const response = error(
      new ConflictError("Player name is already taken in this game")
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      error: "Player name is already taken in this game",
    });
  });

  it("el statusOverride gana para el 403 legacy de Game entry is locked", async () => {
    const response = error(new ConflictError("Game entry is locked"), 403);

    expect(response.status).toBe(403);
    expect(await json(response)).toEqual({ error: "Game entry is locked" });
  });

  it("error(string) sin override usa 500 y ValidationError mapea 400", async () => {
    const internal = error("Internal server error");
    expect(internal.status).toBe(500);
    expect(await json(internal)).toEqual({ error: "Internal server error" });

    const validation = error(new ValidationError("Missing required fields"));
    expect(validation.status).toBe(400);
    expect(await json(validation)).toEqual({ error: "Missing required fields" });
  });
});
