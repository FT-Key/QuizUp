import type { LogLevel } from "@/core/application/ports/logger";

export interface AppConfig {
  readonly mongoUri: string;
  readonly socketUrl: string;
  readonly unsplashAccessKey: string | null;
  readonly logLevel: LogLevel; // D1: ver design §7
}

const DEFAULT_MONGO_URI = "mongodb://localhost:27017/quizapp";
const DEFAULT_SOCKET_URL = "http://localhost:4000";
const DEFAULT_LOG_LEVEL: LogLevel = "info";
const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

/**
 * Lee la configuración del proceso. NO carga `.env`: Next lo hace al arrancar
 * (`next dev`/`next build` leen `.env.local`). Recibir `env` por parámetro la
 * mantiene pura y testeable sin tocar `process.env`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    mongoUri: env.MONGODB_URI?.trim() || DEFAULT_MONGO_URI,
    socketUrl: env.NEXT_PUBLIC_SOCKET_URL?.trim() || DEFAULT_SOCKET_URL,
    unsplashAccessKey: env.UNSPLASH_ACCESS_KEY?.trim() || null,
    logLevel: parseLogLevel(env.LOG_LEVEL),
  };
}

function parseLogLevel(raw: string | undefined): LogLevel {
  const level = raw?.trim().toLowerCase();
  return isLogLevel(level) ? level : DEFAULT_LOG_LEVEL;
}

function isLogLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && (LOG_LEVELS as readonly string[]).includes(value);
}
