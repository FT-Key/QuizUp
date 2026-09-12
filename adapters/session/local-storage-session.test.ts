import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserPlayerSession,
  createLocalStorageSession,
  createMemorySession,
  type StorageLike,
} from "./local-storage-session";

interface FakeStorage extends StorageLike {
  readonly values: Map<string, string>;
}

function createFakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("createLocalStorageSession", () => {
  it("get de una clave ausente devuelve null; set/get/remove delegan con la clave literal", () => {
    const storage = createFakeStorage();
    const session = createLocalStorageSession(storage);

    expect(session.get("playerId")).toBeNull();

    session.set("playerId", "player-1");
    expect(storage.values.get("playerId")).toBe("player-1");
    expect(session.get("playerId")).toBe("player-1");

    session.remove("playerId");
    expect(session.get("playerId")).toBeNull();
  });

  it("setAccessories/getAccessories hacen roundtrip y persisten JSON", () => {
    const storage = createFakeStorage();
    const session = createLocalStorageSession(storage);

    session.setAccessories(["hat", "glasses"]);

    expect(storage.values.get("playerAvatarAccessories")).toBe(
      '["hat","glasses"]'
    );
    expect(session.getAccessories()).toEqual(["hat", "glasses"]);
  });

  it("conserva el quirk caracterizado: setAccessories NO filtra ([\"none\"] se persiste)", () => {
    const storage = createFakeStorage();
    const session = createLocalStorageSession(storage);

    session.setAccessories(["none"]);

    expect(session.getAccessories()).toEqual(["none"]);
  });

  it("getAccessories con JSON inválido devuelve [] sin lanzar", () => {
    const storage = createFakeStorage({
      playerAvatarAccessories: "{json-corrupto",
    });
    const session = createLocalStorageSession(storage);

    expect(() => session.getAccessories()).not.toThrow();
    expect(session.getAccessories()).toEqual([]);
  });

  it("getAccessories con JSON válido no-array devuelve []", () => {
    for (const raw of ['"5"', "5", "{}", "null", "true"]) {
      const session = createLocalStorageSession(
        createFakeStorage({ playerAvatarAccessories: raw })
      );
      expect(session.getAccessories()).toEqual([]);
    }
  });

  it("clear() borra SOLO las 4 claves del jugador y respeta las demás", () => {
    const storage = createFakeStorage({
      playerId: "p1",
      playerName: "Ana",
      playerAvatarSeed: "seed",
      playerAvatarAccessories: '["hat"]',
      "quizup-volume": "0.5",
      "quizup-muted": "true",
    });
    const session = createLocalStorageSession(storage);

    session.clear();

    expect(session.get("playerId")).toBeNull();
    expect(session.get("playerName")).toBeNull();
    expect(session.get("playerAvatarSeed")).toBeNull();
    expect(session.get("playerAvatarAccessories")).toBeNull();
    expect(storage.values.get("quizup-volume")).toBe("0.5");
    expect(storage.values.get("quizup-muted")).toBe("true");
  });
});

describe("createMemorySession", () => {
  it("cumple el mismo contrato sin storage externo", () => {
    const session = createMemorySession();

    expect(session.get("playerName")).toBeNull();

    session.set("playerName", "Ana");
    expect(session.get("playerName")).toBe("Ana");

    session.setAccessories(["hat"]);
    expect(session.getAccessories()).toEqual(["hat"]);

    session.remove("playerName");
    expect(session.get("playerName")).toBeNull();

    session.set("playerId", "p1");
    session.clear();
    expect(session.get("playerId")).toBeNull();
    expect(session.getAccessories()).toEqual([]);
  });

  it("cada instancia es independiente", () => {
    const first = createMemorySession();
    const second = createMemorySession();

    first.set("playerId", "p1");

    expect(second.get("playerId")).toBeNull();
  });
});

describe("createBrowserPlayerSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin window (SSR) cae a una sesión en memoria", () => {
    vi.stubGlobal("window", undefined);

    const session = createBrowserPlayerSession();
    session.set("playerId", "p1");

    expect(session.get("playerId")).toBe("p1");
    expect(createBrowserPlayerSession().get("playerId")).toBeNull();
  });

  it("con window.localStorage delega en él y no lee nada al construirse", () => {
    const storage = createFakeStorage({ playerId: "p1" });
    const getItem = vi.spyOn(storage, "getItem");
    vi.stubGlobal("window", { localStorage: storage });

    const session = createBrowserPlayerSession();

    expect(getItem).not.toHaveBeenCalled();

    session.set("playerName", "Ana");

    expect(storage.values.get("playerName")).toBe("Ana");
    expect(session.get("playerId")).toBe("p1");
  });
});
