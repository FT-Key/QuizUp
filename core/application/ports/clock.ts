export interface Clock {
  /** Epoch en milisegundos (reloj del sistema). */
  now(): number;
}
