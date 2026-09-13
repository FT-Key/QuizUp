/**
 * Tests de `nextTrackIndex` (US-22, AC5 y AC2).
 *
 * Secuencia pura de la playlist: avance y wrap al inicio. El caso de 3 pistas
 * demuestra que agregar una canción no toca el algoritmo (AC2).
 */
import { describe, expect, it } from "vitest";
import { nextTrackIndex } from "./playlist";

describe("nextTrackIndex — avance de playlist con wrap", () => {
  it("playlist de 2: next(0,2) = 1", () => {
    expect(nextTrackIndex(0, 2)).toBe(1);
  });

  it("playlist de 2: next(1,2) = 0 (wrap al inicio, AC5)", () => {
    expect(nextTrackIndex(1, 2)).toBe(0);
  });

  it("playlist de 3 (AC2): next(0,3)=1, next(1,3)=2, next(2,3)=0", () => {
    expect(nextTrackIndex(0, 3)).toBe(1);
    expect(nextTrackIndex(1, 3)).toBe(2);
    expect(nextTrackIndex(2, 3)).toBe(0);
  });

  it("length 0 ⇒ 0 (sin división por cero)", () => {
    expect(nextTrackIndex(0, 0)).toBe(0);
  });

  it("length 1 ⇒ 0 (siempre la misma pista)", () => {
    expect(nextTrackIndex(0, 1)).toBe(0);
  });

  it("length negativo ⇒ 0", () => {
    expect(nextTrackIndex(2, -1)).toBe(0);
  });

  it("current fuera de rango: next(5,2) = 0", () => {
    expect(nextTrackIndex(5, 2)).toBe(0);
  });
});
