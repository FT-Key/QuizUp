import type { Clock } from "@/core/application/ports/clock";
import type { GameCodeGenerator } from "@/core/application/ports/game-code-generator";
import type { IdGenerator } from "@/core/application/ports/id-generator";

// US-11 §3.2: dobles deterministas compartidos por los tests de casos de uso y
// de paridad. Sin estado global: cada llamada crea un doble aislado.

/** Reloj fijo: `now()` devuelve siempre el epoch recibido. */
export function fixedClock(now: number): Clock {
  return { now: () => now };
}

/** Ids deterministas: `prefix-1`, `prefix-2`, ... (prefijo default `id`). */
export function sequentialIds(prefix = "id"): IdGenerator {
  let counter = 0;
  return { next: () => `${prefix}-${++counter}` };
}

/**
 * Códigos deterministas en el orden recibido. Agotar la secuencia lanza un
 * error explícito para no enmascarar bucles (p. ej. los 10 intentos de
 * `create-game`) con `undefined`.
 */
export function sequenceGameCodes(codes: readonly string[]): GameCodeGenerator {
  let index = 0;
  return {
    generate: () => {
      const code = codes[index];
      index += 1;
      if (code === undefined) {
        throw new Error("sequenceGameCodes: no quedan códigos en la secuencia");
      }
      return code;
    },
  };
}
