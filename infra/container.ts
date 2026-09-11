import type { Clock } from "@/core/application/ports/clock";
import type { IdGenerator } from "@/core/application/ports/id-generator";
import type { Logger } from "@/core/application/ports/logger";
import { createSystemClock } from "@/adapters/system/clock";
import { createUuidGenerator } from "@/adapters/system/id-generator";
import { type AppConfig, loadConfig } from "./config";
import { createLogger } from "./logger";

/**
 * Composition root del servidor Next. Se amplía de forma aditiva en US-10/11
 * (`repo`, `useCases`) y US-12 (`connect`/config si hace falta).
 * Solo servidor: NUNCA importar desde componentes/hooks cliente.
 */
export interface Container {
  readonly logger: Logger;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Construcción pura del grafo: sin singletons, sin IO, sin env. */
export function createContainer(config: AppConfig): Container {
  return {
    logger: createLogger({ level: config.logLevel, context: "quizup-next" }),
    clock: createSystemClock(),
    ids: createUuidGenerator(),
  };
}

let cached: Container | null = null;

/**
 * Container lazy por proceso: no evalúa env ni construye nada al importarse.
 * La primera llamada crea el grafo con `loadConfig()` y lo memoiza.
 * No conecta a Mongo: la conexión pertenece a `adapters/persistence/mongo`.
 */
export function getContainer(): Container {
  if (!cached) {
    cached = createContainer(loadConfig());
  }
  return cached;
}
