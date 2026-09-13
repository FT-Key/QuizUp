/**
 * US-22 — Test del helper compartido `clamp01` (`adapters/audio/clamp.ts`).
 * Proyecto `unit` (entorno node).
 */
import { describe, expect, it } from "vitest";
import { clamp01 } from "./clamp";

describe("clamp01", () => {
  it("deja los valores dentro de [0, 1] intactos", () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });

  it("acota por debajo y por encima del rango", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });

  it("trata NaN como 0", () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});
