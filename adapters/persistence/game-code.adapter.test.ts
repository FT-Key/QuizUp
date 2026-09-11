import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameCodeGenerator } from "@/adapters/persistence/game-code.adapter";

// US-11 §2.2: adaptador puro del `GameCodeGenerator`. Sin DB ni red; el rango
// 100000–999999 y la fórmula `floor(100000 + random * 900000)` son paridad
// exacta con `lib/gameCode.ts` (la unicidad queda en el caso de uso).

describe("adapters/persistence/game-code.adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("con Math.random 0 genera el límite inferior 100000", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(createGameCodeGenerator().generate()).toBe("100000");
  });

  it("con Math.random casi 1 genera el límite superior 999999", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999999);

    expect(createGameCodeGenerator().generate()).toBe("999999");
  });

  it("aplica la fórmula legacy floor(100000 + random * 900000)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createGameCodeGenerator().generate()).toBe("550000");
  });

  it("siempre devuelve un string de 6 dígitos dentro del rango", () => {
    const randomSpy = vi.spyOn(Math, "random");
    const generator = createGameCodeGenerator();

    for (let i = 1; i <= 100; i++) {
      randomSpy.mockReturnValue(i / 101);
      const code = generator.generate();

      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    }
  });

  it("consulta Math.random en cada llamada (sin estado interno)", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);
    const generator = createGameCodeGenerator();

    generator.generate();
    generator.generate();

    expect(randomSpy).toHaveBeenCalledTimes(2);
  });
});
