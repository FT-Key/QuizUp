"use client";

import type { PlayerSession } from "@/core/application/ports/player-session";
import { getPlayerSession } from "@/infra/client-container";

/**
 * Seam componentes → sesión del jugador. Devuelve el singleton del client
 * container (estable entre renders); los componentes no importan adapters.
 */
export function usePlayerSession(): PlayerSession {
  return getPlayerSession();
}
