/**
 * US-22, D-D.2 — Mixer de audio: aplica la ganancia del fade y el silencio
 * global sobre un `HTMLAudioElement`, con **Web Audio API como mecanismo
 * primario** y `element.volume`/`element.muted` como **fallback** para entornos
 * sin `AudioContext` (jsdom, navegadores sin soporte).
 *
 * Motivo: en iOS Safari `HTMLMediaElement.volume`/`muted` no son configurables
 * desde JS, así que un crossfade basado en `audio.volume` no cumple AC4. Web
 * Audio (`AudioContext` + `GainNode`) es API del navegador, no una dependencia.
 *
 * El adapter no decide cuándo ni a qué ritmo mover la ganancia: eso es del
 * `MusicPlayer`. Aquí solo se traduce `setTrackGain`/`setSilent`/`resume`.
 */

export interface AudioMixer {
  /** Ganancia de la pista activa (0..1); la mueve el fade. */
  setTrackGain(value: number): void;
  /** Silencio global (mute). No altera el target de volumen del usuario. */
  setSilent(silent: boolean): void;
  /** Reanuda el AudioContext tras el primer gesto (no-op en el fallback). */
  resume(): Promise<void>;
  readonly usingWebAudio: boolean;
}

type AudioContextConstructor = new () => AudioContext;

/** Acota a [0, 1]; NaN se trata como 0 para no propagar un valor inválido. */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Resuelve el constructor de `AudioContext` del navegador
 * (`AudioContext` o el prefijado `webkitAudioContext`) sin `any`: se lee como
 * `unknown` y se estrecha a función.
 */
function resolveAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;

  const scope = window as unknown as Record<string, unknown>;
  const candidate = scope.AudioContext ?? scope.webkitAudioContext;
  return typeof candidate === "function"
    ? (candidate as AudioContextConstructor)
    : null;
}

/** Rama Web Audio: element → trackGain (fade) → masterGain (mute) → destination. */
function createWebAudioMixer(
  context: AudioContext,
  element: HTMLAudioElement
): AudioMixer {
  const source = context.createMediaElementSource(element);
  const trackGain = context.createGain();
  const masterGain = context.createGain();

  source.connect(trackGain);
  trackGain.connect(masterGain);
  masterGain.connect(context.destination);

  return {
    usingWebAudio: true,
    setTrackGain: (value) => {
      trackGain.gain.value = clamp01(value);
    },
    setSilent: (silent) => {
      masterGain.gain.value = silent ? 0 : 1;
    },
    resume: () => context.resume(),
  };
}

/** Rama fallback: el fade y el mute caen directamente en el elemento. */
function createElementFallbackMixer(element: HTMLAudioElement): AudioMixer {
  return {
    usingWebAudio: false,
    setTrackGain: (value) => {
      element.volume = clamp01(value);
    },
    setSilent: (silent) => {
      element.muted = silent;
    },
    resume: () => Promise.resolve(),
  };
}

/**
 * Elige Web Audio si existe `AudioContext`/`webkitAudioContext`; si no (o si
 * `createMediaElementSource` falla), usa `element.volume` + `element.muted`.
 */
export function createAudioMixer(element: HTMLAudioElement): AudioMixer {
  const AudioContextCtor = resolveAudioContextConstructor();
  if (!AudioContextCtor) return createElementFallbackMixer(element);

  try {
    return createWebAudioMixer(new AudioContextCtor(), element);
  } catch {
    // `createMediaElementSource` puede fallar (elemento ya conectado o sin
    // soporte): degradamos al fallback declarado (sin crossfade real, pero sin
    // corte abrupto). No se registra el error para no ensuciar la consola (AC7).
    return createElementFallbackMixer(element);
  }
}
