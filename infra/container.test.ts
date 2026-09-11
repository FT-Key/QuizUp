import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/infra/config";
import { createContainer, getContainer } from "@/infra/container";

// US-09: el container es puro y lazy. `loadConfig` se espía para demostrar que
// importar el módulo no evalúa env; `mongoose.connect` se espía para demostrar
// que el container no toca Mongo (guarda para US-11).

const { loadConfigSpy, connectSpy } = vi.hoisted(() => ({
  loadConfigSpy: vi.fn(
    (): AppConfig => ({
      mongoUri: "mongodb://localhost:27017/quizapp",
      socketUrl: "http://localhost:4000",
      unsplashAccessKey: null,
      logLevel: "info",
    })
  ),
  connectSpy: vi.fn(),
}));

vi.mock("@/infra/config", () => ({
  loadConfig: loadConfigSpy,
}));

vi.mock("mongoose", () => ({
  default: { connect: connectSpy },
}));

const CONFIG: AppConfig = {
  mongoUri: "mongodb://localhost:27017/quizapp",
  socketUrl: "http://localhost:4000",
  unsplashAccessKey: null,
  logLevel: "info",
};

describe("infra/container", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("createContainer construye raíces independientes", () => {
    const first = createContainer(CONFIG);
    const second = createContainer(CONFIG);

    expect(first).not.toBe(second);
    expect(first.logger).not.toBe(second.logger);
    expect(first.clock).not.toBe(second.clock);
    expect(first.ids).not.toBe(second.ids);
  });

  it("clock respeta el reloj fake e ids genera un UUID v4", () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const container = createContainer(CONFIG);

    expect(container.clock.now()).toBe(1_700_000_000_000);

    const id = container.ids.next();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id.length).toBeGreaterThan(0);
  });

  it("logger usa el contexto quizup-next y respeta el nivel", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    createContainer({ ...CONFIG, logLevel: "info" }).logger.info("hola");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("[quizup-next] hola");

    infoSpy.mockClear();
    createContainer({ ...CONFIG, logLevel: "error" }).logger.info("hola");
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("getContainer es lazy real y memoiza", async () => {
    vi.resetModules();
    loadConfigSpy.mockClear();

    const fresh = await import("@/infra/container");
    expect(loadConfigSpy).not.toHaveBeenCalled();

    const first = fresh.getContainer();
    expect(loadConfigSpy).toHaveBeenCalledTimes(1);

    const second = fresh.getContainer();
    expect(second).toBe(first);
    expect(loadConfigSpy).toHaveBeenCalledTimes(1);
  });

  it("getContainer no conecta a Mongo", () => {
    connectSpy.mockClear();

    getContainer();

    expect(connectSpy).not.toHaveBeenCalled();
  });
});
