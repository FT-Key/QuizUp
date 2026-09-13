/**
 * Siguiente índice de una playlist con **wrap** al inicio; lista vacía ⇒ 0.
 *
 * Es la secuencia pura del loop: al terminar la última pista (`ended`) se vuelve
 * a la primera. El avance con IO lo dispara el adapter de audio.
 */
export function nextTrackIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}
