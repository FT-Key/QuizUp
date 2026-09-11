import { describe, expect, it } from "vitest";
import { loadConfig } from "@/infra/config";

// US-09: `loadConfig` es pura y nunca recibe el `process.env` real en tests.
// Replica los fallbacks legacy de `lib/mongoose.ts` y `lib/socket.ts` con
// normalización por `trim()` (D2) y `LOG_LEVEL` aditivo (D1).
//
// Nota de adaptación: Next.js aumenta `NodeJS.ProcessEnv` con un `NODE_ENV`
// requerido, por eso los casos proveen `NODE_ENV: "test"` (no lo lee nadie).

function testEnv(vars: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...vars };
}

describe("infra/config", () => {
  it("sin envs usa los defaults legacy", () => {
    expect(loadConfig(testEnv())).toEqual({
      mongoUri: "mongodb://localhost:27017/quizapp",
      socketUrl: "http://localhost:4000",
      unsplashAccessKey: null,
      logLevel: "info",
    });
  });

  it("respeta los overrides y aplica trim", () => {
    const config = loadConfig(
      testEnv({
        MONGODB_URI: "  mongodb://db.example.com:27017/quizup  ",
        NEXT_PUBLIC_SOCKET_URL: "  https://socket.quizup.test  ",
        UNSPLASH_ACCESS_KEY: "  key-123  ",
        LOG_LEVEL: "debug",
      })
    );

    expect(config).toEqual({
      mongoUri: "mongodb://db.example.com:27017/quizup",
      socketUrl: "https://socket.quizup.test",
      unsplashAccessKey: "key-123",
      logLevel: "debug",
    });
  });

  it("MONGODB_URI vacía o solo espacios cae al fallback (D2)", () => {
    expect(loadConfig(testEnv({ MONGODB_URI: "" })).mongoUri).toBe(
      "mongodb://localhost:27017/quizapp"
    );
    expect(loadConfig(testEnv({ MONGODB_URI: "   " })).mongoUri).toBe(
      "mongodb://localhost:27017/quizapp"
    );
  });

  it("NEXT_PUBLIC_SOCKET_URL vacía cae al default", () => {
    expect(loadConfig(testEnv({ NEXT_PUBLIC_SOCKET_URL: "" })).socketUrl).toBe(
      "http://localhost:4000"
    );
    expect(loadConfig(testEnv({ NEXT_PUBLIC_SOCKET_URL: "   " })).socketUrl).toBe(
      "http://localhost:4000"
    );
  });

  it("UNSPLASH_ACCESS_KEY vacía es null y LOG_LEVEL inválido cae a info", () => {
    expect(loadConfig(testEnv({ UNSPLASH_ACCESS_KEY: "" })).unsplashAccessKey).toBeNull();
    expect(
      loadConfig(testEnv({ UNSPLASH_ACCESS_KEY: "   " })).unsplashAccessKey
    ).toBeNull();
    expect(loadConfig(testEnv({ LOG_LEVEL: "VERBOSE" })).logLevel).toBe("info");
    expect(loadConfig(testEnv({ LOG_LEVEL: " WARN " })).logLevel).toBe("warn");
  });

  it("la validación no es bloqueante: loadConfig nunca lanza", () => {
    expect(() => loadConfig(testEnv())).not.toThrow();
  });
});
