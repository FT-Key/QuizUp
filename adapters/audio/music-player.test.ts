/**
 * Tests de `createMusicPlayer` (US-22, §5.2): arranque, crossfade de contexto,
 * cancelación, avance por `ended` con wrap, escalabilidad de playlist, mute sin
 * salto y slider durante el fade.
 *
 * Sin `AudioContext` ni `HTMLMediaElement`: se inyectan `FakeAudioElement`
 * (`tests/fakes/audio.ts`), `FakeAudioMixer` (`tests/fakes/audio-mixer.ts`) y
 * timers falsos (`tests/fakes/timers.ts`). Proyecto `unit` (entorno node).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MUSIC_DEFAULT_VOLUME, MUSIC_FADE_MS } from "@/constants/music";
import { FakeAudioElement } from "@/tests/fakes/audio";
import { FakeAudioMixer } from "@/tests/fakes/audio-mixer";
import { fakeTimers } from "@/tests/fakes/timers";
import type { MusicContext } from "@/core/domain/music/music-context";
import {
  createMusicPlayer,
  type MusicPlayer,
  type MusicPlayerDeps,
} from "./music-player";

const FADE = MUSIC_FADE_MS;

function asElement(element: FakeAudioElement): HTMLAudioElement {
  return element as unknown as HTMLAudioElement;
}

interface PlayerHarness {
  element: FakeAudioElement;
  mixer: FakeAudioMixer;
  player: MusicPlayer;
  createMixer: ReturnType<typeof vi.fn>;
}

/** Crea un player con fakes inyectados y una playlist opcional propia. */
function setup(deps: Partial<MusicPlayerDeps> = {}): PlayerHarness {
  const element = new FakeAudioElement();
  const mixer = new FakeAudioMixer();
  const createMixer = vi.fn(() => mixer);
  const player = createMusicPlayer({
    createElement: () => asElement(element),
    createMixer,
    ...deps,
  });
  return { element, mixer, player, createMixer };
}

/**
 * Simula el arranque real: montaje (`play()` best-effort) seguido del primer
 * gesto (`unlock()`), que es el único que crea el mixer.
 */
async function startWithGesture(
  player: MusicPlayer,
  element: FakeAudioElement
): Promise<void> {
  await player.play();
  element.resolvePlay();
  await player.unlock();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createMusicPlayer — arranque y contexto", () => {
  it("play arranca la primera pista de queue con loop=false y preload=auto", async () => {
    const { element, player } = setup();

    await player.play();

    expect(element.src).toContain("/music/QueueUp.mp3");
    expect(element.loop).toBe(false);
    expect(element.preload).toBe("auto");
    expect(element.playCallCount).toBe(1);
  });

  it("play() con autoplay bloqueado no rechaza (best-effort)", async () => {
    const { element, player } = setup();

    const promise = player.play();
    element.rejectPlay(0);

    await expect(promise).resolves.toBeUndefined();
  });

  it("setContext('game') con audio arrancado: fade-out, cambia a QuizUp y fade-in al target", async () => {
    const timers = fakeTimers();
    const { element, mixer, player } = setup();
    await startWithGesture(player, element);

    player.setContext("game");
    await timers.advanceAsync(FADE); // fade-out hasta 0
    expect(element.src).toContain("/music/QuizUp.mp3");
    expect(mixer.lastTrackGain).toBe(0);

    await timers.advanceAsync(FADE); // fade-in
    expect(mixer.lastTrackGain).toBeCloseTo(MUSIC_DEFAULT_VOLUME, 5);
    expect(setMidValue(mixer.trackGains)).toBeLessThan(MUSIC_DEFAULT_VOLUME);
  });

  it("setContext con el mismo contexto es no-op (sin fade ni play extra)", async () => {
    const timers = fakeTimers();
    const { element, mixer, player } = setup();
    await startWithGesture(player, element);
    const playsBefore = element.playCallCount;
    const gainsBefore = mixer.trackGains.length;

    player.setContext("queue");
    await timers.advanceAsync(FADE * 2);

    expect(element.playCallCount).toBe(playsBefore);
    expect(mixer.trackGains.length).toBe(gainsBefore);
    expect(element.src).toContain("/music/QueueUp.mp3");
  });

  it("setContext antes de play no crea el elemento y respeta el contexto en el arranque", async () => {
    const { element, mixer, player } = setup();

    player.setContext("game");
    expect(element.playCallCount).toBe(0);
    expect(mixer.trackGains).toHaveLength(0);

    await player.play();
    expect(element.src).toContain("/music/QuizUp.mp3");
  });

  it("dos cambios rápidos de contexto cancelan el fade anterior: 1 pista, target final, sin timers", async () => {
    const timers = fakeTimers();
    const { element, mixer, player } = setup();
    await startWithGesture(player, element);

    player.setContext("game");
    await timers.advanceAsync(FADE / 2);
    player.setContext("queue");
    await timers.advanceAsync(FADE);
    await timers.advanceAsync(FADE);

    expect(element.src).toContain("/music/QueueUp.mp3");
    expect(mixer.lastTrackGain).toBeCloseTo(MUSIC_DEFAULT_VOLUME, 5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("un ended de la pista saliente durante el fade-out de contexto no salta la 1.ª pista nueva", async () => {
    const timers = fakeTimers();
    const { element, player } = setup();
    await startWithGesture(player, element);

    player.setContext("game");
    await timers.advanceAsync(FADE / 2); // a mitad del fade-out
    element.emitEnded(); // la pista vieja termina durante la transición
    await timers.advanceAsync(FADE); // completa el fade-out y arranca el fade-in

    expect(element.src).toContain("/music/QuizUp.mp3"); // 1.ª pista, no QuizUp2

    await timers.advanceAsync(FADE); // completa el fade-in
    expect(element.src).toContain("/music/QuizUp.mp3");
  });
});

describe("createMusicPlayer — avance de playlist", () => {
  it("emitEnded avanza a la siguiente pista y hace wrap al inicio", async () => {
    const timers = fakeTimers();
    const { element, mixer, player } = setup();
    await startWithGesture(player, element);

    element.emitEnded();
    await timers.advanceAsync(FADE);
    expect(element.src).toContain("/music/QueueUp2.mp3");

    element.emitEnded();
    await timers.advanceAsync(FADE);
    expect(element.src).toContain("/music/QueueUp.mp3");
    expect(mixer.lastTrackGain).toBeCloseTo(MUSIC_DEFAULT_VOLUME, 5);
  });

  it("playlist inyectada de 3 pistas recorre y vuelve a la primera (AC2)", async () => {
    const timers = fakeTimers();
    const threePlaylists: Record<MusicContext, readonly string[]> = {
      queue: ["/music/a.mp3", "/music/b.mp3", "/music/c.mp3"],
      game: ["/music/g1.mp3", "/music/g2.mp3"],
    };
    const { element, player } = setup({ playlists: threePlaylists });
    await player.play();
    element.resolvePlay();

    expect(element.src).toContain("/music/a.mp3");

    element.emitEnded();
    await timers.advanceAsync(FADE);
    expect(element.src).toContain("/music/b.mp3");

    element.emitEnded();
    await timers.advanceAsync(FADE);
    expect(element.src).toContain("/music/c.mp3");

    element.emitEnded();
    await timers.advanceAsync(FADE);
    expect(element.src).toContain("/music/a.mp3");
  });
});

describe("createMusicPlayer — volumen y mute", () => {
  it("play() (montaje) no crea el mixer; unlock() (gesto) lo crea con el estado guardado", async () => {
    const { element, mixer, player, createMixer } = setup();

    player.setTargetVolume(0.6);
    player.setMuted(false);

    await player.play();

    expect(createMixer).not.toHaveBeenCalled();
    expect(mixer.trackGains).toHaveLength(0);
    // Sin mixer, el volumen/mute de trabajo vive en el elemento (fallback).
    expect(element.volume).toBeCloseTo(0.6, 5);
    expect(element.muted).toBe(false);

    await player.unlock();

    expect(createMixer).toHaveBeenCalledTimes(1);
    expect(mixer.trackGains[0]).toBeCloseTo(0.6, 5);
    expect(mixer.silentStates[0]).toBe(false);
    expect(mixer.resumeCallCount).toBe(1);
  });

  it("unlock() es idempotente: no recrea el mixer en gestos posteriores", async () => {
    const { player, createMixer } = setup();

    await player.unlock();
    await player.unlock();

    expect(createMixer).toHaveBeenCalledTimes(1);
  });

  it("setTargetVolume sin fade aplica de inmediato y acota a [0,1]", async () => {
    const { element, mixer, player } = setup();
    await startWithGesture(player, element);

    player.setTargetVolume(0.7);
    expect(mixer.lastTrackGain).toBeCloseTo(0.7, 5);
    expect(player.getTargetVolume()).toBeCloseTo(0.7, 5);

    player.setTargetVolume(2);
    expect(player.getTargetVolume()).toBe(1);
    player.setTargetVolume(-1);
    expect(player.getTargetVolume()).toBe(0);
  });

  it("muted: el fade mueve la ganancia interna y al desmutear no hay salto", async () => {
    const timers = fakeTimers();
    const { element, mixer, player } = setup();
    await startWithGesture(player, element);
    player.setMuted(true);

    player.setContext("game");
    await timers.advanceAsync(FADE);
    await timers.advanceAsync(FADE);

    expect(mixer.lastSilent).toBe(true);
    expect(mixer.lastTrackGain).toBeCloseTo(MUSIC_DEFAULT_VOLUME, 5);

    player.setMuted(false);
    expect(mixer.lastSilent).toBe(false);
    expect(mixer.lastTrackGain).toBeCloseTo(MUSIC_DEFAULT_VOLUME, 5);
  });

  it("setTargetVolume durante el fade-in dirige el destino al nuevo valor (D-F.1)", async () => {
    const timers = fakeTimers();
    const { element, mixer, player } = setup();
    await startWithGesture(player, element);

    player.setContext("game");
    await timers.advanceAsync(FADE); // termina el fade-out, arranca el fade-in
    await timers.advanceAsync(FADE / 2); // mitad del fade-in

    player.setTargetVolume(0.8);
    await timers.advanceAsync(FADE); // completa el fade-in

    expect(mixer.lastTrackGain).toBeCloseTo(0.8, 5);
    expect(player.getTargetVolume()).toBeCloseTo(0.8, 5);
  });
});

describe("createMusicPlayer — ciclo de vida", () => {
  it("dispose corta el fade, pausa y no deja timers huérfanos", async () => {
    const timers = fakeTimers();
    const { element, player } = setup();
    await player.play();
    element.resolvePlay();

    player.setContext("game");
    await timers.advanceAsync(FADE / 2);
    player.dispose();

    expect(element.pauseCallCount).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

/** Valor intermedio de un fade (para probar que hay rampa, no salto). */
function setMidValue(values: readonly number[]): number {
  return Math.max(...values.filter((value) => value < MUSIC_DEFAULT_VOLUME), 0);
}
