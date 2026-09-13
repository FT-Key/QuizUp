/**
 * US-22 — Helper compartido de la capa de audio: acota una ganancia al rango
 * válido `[0, 1]`. Lo usan el mixer (`audio-mixer.ts`) y el player
 * (`music-player.ts`) para no duplicar la misma regla.
 */

/** Acota a [0, 1]; `NaN` se trata como 0 para no propagar un valor inválido. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
