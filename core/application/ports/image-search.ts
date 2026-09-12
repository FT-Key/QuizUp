/** Foto del proveedor con el shape REST legacy (6 claves). */
export interface ImageSearchItem {
  id: string;
  url: string;
  thumb?: string;
  alt: string;
  author: string;
  authorLink: string;
}

export interface ImageSearchPayload {
  results: ImageSearchItem[];
  page: number;
  totalPages: number;
}

/** Fallos de contrato del proveedor (no lanza); lo inesperado (fetch/json) rechaza. */
export type ImageSearchGatewayResult =
  | { kind: "ok"; payload: ImageSearchPayload }
  | { kind: "provider_rate_limited" } // 403 upstream
  | { kind: "provider_cooldown" } // cooldown activo (no se llamó a fetch)
  | { kind: "provider_error"; status: number }; // !ok (excluye 403)

export interface ImageSearchGateway {
  /** ¿Hay credenciales configuradas? La key nunca cruza el core. */
  hasCredentials(): boolean;
  /** Busca upstream. Rechaza solo en fallos inesperados (fetch/json). */
  search(input: {
    query: string;
    page: number;
  }): Promise<ImageSearchGatewayResult>;
}

export interface ImageSearchCache {
  get(key: string): ImageSearchPayload | null;
  set(key: string, payload: ImageSearchPayload): void;
}

export interface IpRateLimiter {
  /** Registra el intento de `ip`; devuelve `true` si superó el límite de la ventana. */
  hit(ip: string): boolean;
}
