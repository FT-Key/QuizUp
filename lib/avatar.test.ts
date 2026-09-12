/**
 * Caracterización de `lib/avatar.ts` (US-18, design §D3/A4).
 *
 * Congela el comportamiento observable del generador de avatares, que es la
 * red de runtime del cambio de tipo `Record<string, any>` → `StyleOptions`:
 * determinismo por seed, sensibilidad a seed/expresión y codificación del data
 * URI. No se asertan detalles internos del SVG de dicebear (solo igualdad o
 * desigualdad entre salidas), para no acoplarse a su versión de estilos.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVATAR_SEED,
  generateAvatarSvg,
  getAvatarDataUri,
} from "@/lib/avatar";

const DATA_URI_PREFIX = "data:image/svg+xml;charset=utf-8,";

describe("lib/avatar — determinismo del SVG", () => {
  it("la misma configuración genera exactamente el mismo SVG", () => {
    const config = { seed: "ana", expression: "happy" as const, size: 256 };

    expect(generateAvatarSvg(config)).toBe(generateAvatarSvg(config));
  });

  it("seeds distintas generan SVGs distintos", () => {
    const first = generateAvatarSvg({ seed: "ana" });
    const second = generateAvatarSvg({ seed: "luis" });

    expect(first).not.toBe(second);
  });

  it("la expresión cambia el SVG para la misma seed", () => {
    const happy = generateAvatarSvg({ seed: "ana", expression: "happy" });
    const sad = generateAvatarSvg({ seed: "ana", expression: "sad" });

    expect(happy).not.toBe(sad);
  });

  it("getAvatarDataUri codifica el SVG generado con el prefijo actual", () => {
    const config = { seed: "ana" };
    const uri = getAvatarDataUri(config);

    expect(uri.startsWith(DATA_URI_PREFIX)).toBe(true);
    expect(decodeURIComponent(uri.slice(DATA_URI_PREFIX.length))).toBe(
      generateAvatarSvg(config)
    );
  });

  it("la seed por defecto exportada es determinista", () => {
    expect(DEFAULT_AVATAR_SEED).toBe("QuizUpDefault");
    expect(generateAvatarSvg({ seed: DEFAULT_AVATAR_SEED })).toBe(
      generateAvatarSvg({ seed: "QuizUpDefault" })
    );
  });
});
