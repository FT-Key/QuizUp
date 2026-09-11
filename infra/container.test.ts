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

// US-11: el grafo ahora importa `game.schema.ts`, que llama a `new Schema(...)`,
// `.index(...)` y `models.Game || model("Game", ...)` al cargarse. El mock debe
// exponer esas APIs sin conectar a Mongo.
vi.mock("mongoose", () => {
  class Schema {
    index() {
      return this;
    }
  }
  return {
    default: { connect: connectSpy },
    Schema,
    model: vi.fn(() => ({})),
    models: {},
  };
});

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
    // US-11: cada container cablea sus propias raíces de repo/generador/use cases.
    expect(first.gameCodes).not.toBe(second.gameCodes);
    expect(first.games).not.toBe(second.games);
    expect(first.useCases).not.toBe(second.useCases);
    expect(typeof first.games.findById).toBe("function");
  });

  it("el grafo expone gameCodes, el repo Mongo y los 7 casos de uso", () => {
    const container = createContainer(CONFIG);

    expect(typeof container.gameCodes.generate).toBe("function");
    expect(typeof container.games.existsByCode).toBe("function");
    expect(typeof container.games.findById).toBe("function");
    expect(typeof container.games.listRecent).toBe("function");
    expect(typeof container.games.create).toBe("function");
    expect(typeof container.games.addPlayer).toBe("function");
    expect(typeof container.games.setStatusAndIndex).toBe("function");

    expect(Object.keys(container.useCases).sort()).toEqual([
      "createGame",
      "finishGame",
      "getGame",
      "getResults",
      "joinGame",
      "listGames",
      "startGame",
    ]);
    for (const useCase of Object.values(container.useCases)) {
      expect(typeof useCase.execute).toBe("function");
    }
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
