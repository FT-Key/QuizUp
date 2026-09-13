/**
 * US-22, D-E.1 / D-D.1 / D-F.1 — `MusicPlayer`: orquesta la playlist por
 * contexto, el avance por `ended` (con wrap) y el crossfade secuencial
 * cancelable sobre **un solo** `HTMLAudioElement` reutilizado.
 *
 * - Un único elemento (`loop = false`, `preload = "auto"`) que persiste (AC8).
 * - Avance por `ended` → `nextTrackIndex` → `src` siguiente → fade-in (AC5).
 * - Cambio de contexto con audio arrancado → fade-out (hasta 0) y recién
 *   entonces fade-in de la primera pista nueva (secuencial, AC4).
 * - Cancelación por generación: al iniciar otro fade se limpia el anterior y
 *   los ticks viejos se ignoran (no quedan intervals huérfanos).
 * - `setTargetVolume` durante un fade-in: el tick lee `targetVolume` vivo, así
 *   el slider no queda pisado (D-F.1). Durante un fade-out no se pisa.
 * - `setMuted` solo toca el silencio global; los fades siguen moviendo la
 *   ganancia interna para que al desmutear no haya salto (D-D.3).
 *
 * El mixer (y con él el `AudioContext`) se crea de forma perezosa en `unlock()`,
 * llamado desde el primer gesto (`click`/`keydown`) del hook. `play()` nunca lo
 * crea: en el montaje solo intenta `element.play()` best-effort y aplica
 * volumen/mute con la vía disponible, evitando el warning de Chrome (AC7).
 */
import { clamp01 } from "./clamp";
import {
  MUSIC_DEFAULT_VOLUME,
  MUSIC_FADE_MS,
  MUSIC_FADE_STEP_MS,
  MUSIC_PLAYLISTS,
} from "@/constants/music";
import {
  MUSIC_CONTEXT,
  type MusicContext,
} from "@/core/domain/music/music-context";
import { nextTrackIndex } from "@/core/domain/music/playlist";
import { createAudioMixer, type AudioMixer } from "./audio-mixer";

export interface MusicPlayer {
  /** Cambia de contexto; si difiere del actual, crossfade a la 1.ª pista de la nueva playlist. */
  setContext(context: MusicContext): void;
  /** Volumen objetivo del usuario (0..1). Si no hay fade en curso, aplica de inmediato. */
  setTargetVolume(value: number): void;
  setMuted(muted: boolean): void;
  getTargetVolume(): number;
  isMuted(): boolean;
  /**
   * Crea el mixer perezosamente y lo reanuda. Es el **único** punto que crea el
   * `AudioContext`; se llama desde el primer gesto (`click`/`keydown`).
   */
  unlock(): Promise<void>;
  /**
   * Arranca/reintenta la reproducción best-effort **sin crear el mixer**: aplica
   * volumen/mute por la vía disponible y reintenta `element.play()`.
   */
  play(): Promise<void>;
  /** Corta fades y pausa (tests/teardown). No se llama en navegación normal. */
  dispose(): void;
}

export interface MusicPlayerDeps {
  createElement?: (src: string) => HTMLAudioElement;
  createMixer?: (element: HTMLAudioElement) => AudioMixer;
  playlists?: Record<MusicContext, readonly string[]>;
  fadeMs?: number;
  stepMs?: number;
}

type ActiveFade = "in" | "out" | null;

export function createMusicPlayer(deps: MusicPlayerDeps = {}): MusicPlayer {
  const createElement =
    deps.createElement ?? ((src: string) => new Audio(src));
  const createMixer = deps.createMixer ?? createAudioMixer;
  const playlists = deps.playlists ?? MUSIC_PLAYLISTS;
  const fadeMs = deps.fadeMs ?? MUSIC_FADE_MS;
  const stepMs = deps.stepMs ?? MUSIC_FADE_STEP_MS;

  let context: MusicContext = MUSIC_CONTEXT.QUEUE;
  let currentIndex = 0;
  let targetVolume = MUSIC_DEFAULT_VOLUME;
  let muted = true;
  let trackGain = MUSIC_DEFAULT_VOLUME;

  let element: HTMLAudioElement | null = null;
  let mixer: AudioMixer | null = null;
  let activeFade: ActiveFade = null;
  let fadeGeneration = 0;
  let fadeTimer: ReturnType<typeof setInterval> | null = null;
  /** true mientras un cambio de contexto está en curso (fade-out → swap). */
  let contextTransition = false;

  function getPlaylist(musicContext: MusicContext): readonly string[] {
    return playlists[musicContext];
  }

  function stopFadeTimer(): void {
    if (fadeTimer !== null) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  /** Invalida cualquier tick pendiente y deja de considerar un fade activo. */
  function cancelFade(): void {
    stopFadeTimer();
    fadeGeneration += 1;
    activeFade = null;
  }

  /**
   * Aplica la ganancia de pista. Con mixer, mueve el `GainNode`; sin mixer, usa
   * `element.volume` como control de trabajo hasta que el gesto cree el mixer.
   */
  function applyTrackGain(value: number): void {
    trackGain = value;
    if (mixer !== null) {
      mixer.setTrackGain(value);
    } else if (element !== null) {
      element.volume = clamp01(value);
    }
  }

  /** Aplica el estado guardado (volumen/mute) al elemento cuando no hay mixer. */
  function applyElementFallback(audio: HTMLAudioElement): void {
    audio.volume = clamp01(trackGain);
    audio.muted = muted;
  }

  function ensureElement(): HTMLAudioElement {
    if (element !== null) return element;

    const playlist = getPlaylist(context);
    const src = playlist[currentIndex] ?? playlist[0] ?? "";
    const created = createElement(src);
    created.src = src;
    created.loop = false;
    created.preload = "auto";
    created.addEventListener("ended", handleEnded);
    element = created;
    return created;
  }

  /**
   * Crea el mixer en el primer gesto (único punto que instancia el
   * `AudioContext`) y le aplica el estado guardado.
   */
  function ensureMixer(): AudioMixer {
    if (mixer !== null) return mixer;

    const created = createMixer(ensureElement());
    created.setSilent(muted);
    created.setTrackGain(trackGain);
    mixer = created;
    return created;
  }

  /** Reanuda el mixer; no-op si aún no existe. `resume()` es best-effort. */
  async function resumeMixer(): Promise<void> {
    if (mixer === null) return;
    try {
      await mixer.resume();
    } catch {
      // resume() puede rechazar si el gesto no alcanza; best-effort (AC7).
    }
  }

  async function tryPlay(audio: HTMLAudioElement): Promise<void> {
    try {
      await audio.play();
    } catch {
      // Best-effort: el navegador puede bloquear el autoplay (AC7).
    }
  }

  function startFadeOut(durationMs: number, onDone: () => void): void {
    cancelFade();
    const generation = fadeGeneration;
    const steps = Math.max(1, Math.round(durationMs / stepMs));
    const from = trackGain;
    let tick = 0;

    activeFade = "out";
    fadeTimer = setInterval(() => {
      if (generation !== fadeGeneration) return;
      tick += 1;
      const progress = Math.min(1, tick / steps);
      applyTrackGain(from * (1 - progress));
      if (progress >= 1) {
        stopFadeTimer();
        activeFade = null;
        onDone();
      }
    }, stepMs);
  }

  function startFadeIn(durationMs: number): void {
    cancelFade();
    const generation = fadeGeneration;
    const steps = Math.max(1, Math.round(durationMs / stepMs));
    let tick = 0;

    activeFade = "in";
    applyTrackGain(0);
    fadeTimer = setInterval(() => {
      if (generation !== fadeGeneration) return;
      tick += 1;
      const progress = Math.min(1, tick / steps);
      // Lee el target vivo en cada tick (D-F.1): el slider no queda pisado.
      applyTrackGain(targetVolume * progress);
      if (progress >= 1) {
        stopFadeTimer();
        activeFade = null;
        applyTrackGain(targetVolume);
      }
    }, stepMs);
  }

  /** Cambia la pista y hace solo el fade-in (la saliente ya terminó). */
  function playTrackAt(index: number): void {
    const audio = ensureElement();
    const playlist = getPlaylist(context);
    const src = playlist[index];
    if (src === undefined) return;

    currentIndex = index;
    cancelFade();
    applyTrackGain(0);
    audio.src = src;
    audio.currentTime = 0;
    void tryPlay(audio);
    startFadeIn(fadeMs);
  }

  function handleEnded(): void {
    // El `ended` de la pista saliente dentro de la ventana de fade-out no debe
    // avanzar la playlist nueva (saltaría la 1.ª pista).
    if (contextTransition) return;

    const playlist = getPlaylist(context);
    playTrackAt(nextTrackIndex(currentIndex, playlist.length));
  }

  function setContext(nextContext: MusicContext): void {
    if (nextContext === context) return;

    context = nextContext;
    currentIndex = 0;

    const audio = element;
    if (audio === null) return; // aún no arrancó: el src se fija en play()

    const src = getPlaylist(nextContext)[0];
    if (src === undefined) return;

    contextTransition = true;
    startFadeOut(fadeMs, () => {
      contextTransition = false;
      audio.src = src;
      audio.currentTime = 0;
      void tryPlay(audio);
      startFadeIn(fadeMs);
    });
  }

  function setTargetVolume(value: number): void {
    targetVolume = clamp01(value);
    // Durante un fade el tick manda; sin fade, respuesta inmediata del slider.
    if (activeFade === null) applyTrackGain(targetVolume);
  }

  function setMuted(nextMuted: boolean): void {
    muted = nextMuted;
    if (mixer !== null) {
      mixer.setSilent(muted);
    } else if (element !== null) {
      element.muted = muted;
    }
  }

  /** Único punto que crea el mixer; se llama desde el primer gesto. */
  function unlock(): Promise<void> {
    ensureMixer();
    return resumeMixer();
  }

  function play(): Promise<void> {
    const audio = ensureElement();
    // `play()` nunca crea el mixer. Aplica volumen/mute por la vía disponible:
    // con mixer, los `GainNode`; sin mixer, el elemento como control de trabajo.
    if (mixer !== null) {
      mixer.setSilent(muted);
      mixer.setTrackGain(trackGain);
    } else {
      applyElementFallback(audio);
    }
    // `play()` del elemento es best-effort y no se espera: el navegador puede
    // bloquear el autoplay y la promesa quedaría colgada (AC7).
    if (audio.paused) void tryPlay(audio);
    return Promise.resolve();
  }

  function dispose(): void {
    cancelFade();
    contextTransition = false;
    if (element !== null) {
      element.removeEventListener("ended", handleEnded);
      element.pause();
    }
    element = null;
    mixer = null;
  }

  return {
    setContext,
    setTargetVolume,
    setMuted,
    getTargetVolume: () => targetVolume,
    isMuted: () => muted,
    unlock,
    play,
    dispose,
  };
}

let singleton: MusicPlayer | null = null;

/** Singleton memoizado del navegador; sobrevive a la navegación de cliente (AC8). */
export function getMusicPlayer(): MusicPlayer {
  if (singleton === null) {
    singleton = createMusicPlayer();
  }
  return singleton;
}
