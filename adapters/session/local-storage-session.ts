import type {
  PlayerSession,
  PlayerSessionKey,
} from "@/core/application/ports/player-session";

/** Subconjunto de Storage necesario (permite dobles en tests node). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Claves del jugador (las 4 legacy); `clear()` solo toca estas. */
const PLAYER_KEYS: readonly PlayerSessionKey[] = [
  "playerId",
  "playerName",
  "playerAvatarSeed",
  "playerAvatarAccessories",
];

function createSessionFromStorage(storage: StorageLike): PlayerSession {
  return {
    get: (key) => storage.getItem(key),

    set: (key, value) => {
      storage.setItem(key, value);
    },

    remove: (key) => {
      storage.removeItem(key);
    },

    getAccessories: () => {
      const raw = storage.getItem("playerAvatarAccessories");
      if (raw === null) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Sin filtrar elementos: paridad con el legacy caracterizado.
          return parsed as string[];
        }
      } catch {
        // JSON corrupto ⇒ [].
      }
      return [];
    },

    setAccessories: (accessories) => {
      storage.setItem("playerAvatarAccessories", JSON.stringify(accessories));
    },

    clear: () => {
      for (const key of PLAYER_KEYS) {
        storage.removeItem(key);
      }
    },
  };
}

export function createLocalStorageSession(storage: StorageLike): PlayerSession {
  return createSessionFromStorage(storage);
}

export function createMemorySession(): PlayerSession {
  const values = new Map<string, string>();
  return createSessionFromStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  });
}

/** localStorage si está disponible; si no (SSR, navegador restringido), memoria. */
export function createBrowserPlayerSession(): PlayerSession {
  if (typeof window === "undefined") return createMemorySession();
  try {
    const storage = window.localStorage;
    return storage ? createLocalStorageSession(storage) : createMemorySession();
  } catch {
    // Acceso restringido (p. ej. iframe sandbox) ⇒ memoria.
    return createMemorySession();
  }
}
