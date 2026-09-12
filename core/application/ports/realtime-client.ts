export type Unsubscribe = () => void;
export type RealtimeHandler = (...args: unknown[]) => void;

/** Cliente realtime mínimo (puerto). "connect"/"disconnect" son eventos más. */
export interface RealtimeClient {
  readonly connected: boolean;
  /** Suscribe y devuelve la baja. */
  on(event: string, handler: RealtimeHandler): Unsubscribe;
  off(event: string, handler: RealtimeHandler): void;
  emit(event: string, ...args: unknown[]): void;
}
