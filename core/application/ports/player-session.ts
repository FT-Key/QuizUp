/** Claves persistidas por la sesión del jugador (las 4 claves legacy). */
export type PlayerSessionKey =
  | "playerId"
  | "playerName"
  | "playerAvatarSeed"
  | "playerAvatarAccessories";

/**
 * Sesión del jugador con claves tipadas. No conoce localStorage ni React:
 * la implementación decide el backend (localStorage o memoria).
 */
export interface PlayerSession {
  get(key: PlayerSessionKey): string | null;
  set(key: PlayerSessionKey, value: string): void;
  remove(key: PlayerSessionKey): void;
  /** Lee `playerAvatarAccessories` con parseo seguro: JSON inválido o no-array ⇒ []. */
  getAccessories(): string[];
  /** Persiste `playerAvatarAccessories` como JSON. NO filtra ("none" se conserva: caracterizado). */
  setAccessories(accessories: string[]): void;
  /** Elimina SOLO las 4 claves del jugador (no toca otras claves del storage, p. ej. audio). */
  clear(): void;
}
