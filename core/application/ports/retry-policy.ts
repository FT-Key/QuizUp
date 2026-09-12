/** Strategy de reintentos pura: decide CUÁNDO; no programa timers ni mira el reloj. */
export interface RetryPolicy {
  /** Espera antes del intento `attempt` (1-based); `null` = plan agotado. */
  nextDelayMs(attempt: number): number | null;
}

/** Estrategia de la vista admin caracterizada: 5 reintentos cada 3000 ms. */
export function createFixedRetryPolicy(options: {
  maxRetries: number;
  delayMs: number;
}): RetryPolicy {
  return {
    nextDelayMs: (attempt) =>
      attempt >= 1 && attempt <= options.maxRetries ? options.delayMs : null,
  };
}
