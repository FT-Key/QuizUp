// US-22: helper de timers falsos para el crossfade y el avance de playlist.
// El `AudioPlayer` actual no agenda timers, pero la implementación de la US sí
// (bajar/subir `volume` por pasos y, opcionalmente, esperar entre pasos). Este
// helper deja el reloj bajo control del test sin acoplar los fakes a `vi`.
//
// Uso típico:
//
//   const timers = fakeTimers();
//   // ... render + disparar cambio de contexto/pista ...
//   await timers.advanceAsync(FADE_STEP_MS);
//   await timers.advanceAsync(FADE_DURATION_MS);
//   expect(audio.volume).toBeCloseTo(volumeConfigurado);
//   timers.restore();
//
// `advanceAsync` usa `vi.advanceTimersByTimeAsync`: además de correr los
// timers, deja flush de las microtareas (promesas) que dispare cada tick, algo
// imprescindible si el fade hace `await` entre pasos. `advance` es la variante
// síncrona para código sin awaits.
import { vi } from "vitest";

/** Paso por defecto del fade: avanzar en múltiplos de este valor. */
export const FADE_STEP_MS = 50;

export interface FakeTimers {
  /** Avanza el reloj falso `ms` (síncrono, sin flush de microtareas). */
  advance(ms: number): void;
  /** Avanza el reloj falso `ms` y deja correr las microtareas (async). */
  advanceAsync(ms: number): Promise<void>;
  /** Timestamp virtual actual. */
  now(): number;
  /** Vuelve a los timers reales. */
  restore(): void;
}

/** Activa los timers falsos de Vitest y devuelve atajos para avanzarlos. */
export function fakeTimers(now = 0): FakeTimers {
  vi.useFakeTimers();
  if (now !== 0) {
    vi.setSystemTime(now);
  }
  return {
    advance: (ms: number) => {
      vi.advanceTimersByTime(ms);
    },
    advanceAsync: async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
    },
    now: () => Date.now(),
    restore: () => {
      vi.useRealTimers();
    },
  };
}
