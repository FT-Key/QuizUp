import { describe, expect, it } from "vitest";
import {
  joinGameSchema,
  parseJoinGameBody,
  playerAvatarSchema,
} from "@/adapters/http/schemas/join-game.schema";
import { ValidationError } from "@/core/domain/errors";

// US-12 (§6/§9, D4): `gameId`/`playerName` son opcionales a propósito; la
// requeridización vive en el caso de uso. El borde solo valida tipos y `avatar`,
// y todo fallo de Zod usa el mensaje legacy de la ruta.

function validationError(run: () => unknown): ValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) return error;
    throw error;
  }
  throw new Error("Se esperaba un ValidationError");
}

describe("adapters/http/schemas/join-game.schema", () => {
  it("un body vacío parsea: la ausencia de campos la decide el use case (D4)", () => {
    expect(parseJoinGameBody({})).toEqual({});
  });

  it("gameId y playerName string parsean tal cual", () => {
    expect(
      parseJoinGameBody({ gameId: "123456", playerName: "Alice" })
    ).toEqual({ gameId: "123456", playerName: "Alice" });
  });

  it("un avatar válido se conserva", () => {
    const avatar = { seed: "custom", accessories: ["glasses"] };
    expect(
      parseJoinGameBody({ gameId: "123456", playerName: "Alice", avatar })
    ).toEqual({ gameId: "123456", playerName: "Alice", avatar });
  });

  it("un avatar con tipos inválidos lanza ValidationError con el mensaje legacy", () => {
    const error = validationError(() =>
      parseJoinGameBody({
        gameId: "123456",
        playerName: "Alice",
        avatar: { seed: 42 },
      })
    );

    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "Game ID and player name are required",
    });
  });

  it("un gameId numérico (campo no-string) lanza ValidationError con el mensaje legacy", () => {
    const error = validationError(() =>
      parseJoinGameBody({ gameId: 123456, playerName: "Alice" })
    );

    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "Game ID and player name are required",
    });
  });

  it("los schemas exportados fijan el contrato exacto (§9)", () => {
    expect(playerAvatarSchema.safeParse({ seed: "x" }).success).toBe(true);
    expect(playerAvatarSchema.safeParse({ seed: "x", accessories: [1] }).success).toBe(false);
    expect(joinGameSchema.safeParse({}).success).toBe(true);
  });
});
