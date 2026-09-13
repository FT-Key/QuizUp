"use client";

/**
 * US-22, D-E.1 / D-F.1 — Pegamento React ↔ `getMusicPlayer()`.
 *
 * El componente `AudioPlayer` pasa a ser UI fina: toda la lógica de audio
 * (contexto, autoplay best-effort, volumen/mute y persistencia) vive aquí.
 *
 * - Montaje: lee `quizup-volume`/`quizup-muted` de `localStorage` (defaults
 *   `MUSIC_DEFAULT_VOLUME`/mute) y los aplica al player; arranca la
 *   reproducción best-effort.
 * - Autoplay: registra un único desbloqueo en el primer `click`/`keydown` de
 *   `document` (`player.unlock()` crea el mixer/`AudioContext` y lo reanuda;
 *   `player.play()` reintenta el elemento) y limpia los listeners al desmontar
 *   (AC7). El mixer nunca se crea en el montaje.
 * - Contexto: un efecto publica en el player el contexto del store suscriptor
 *   (`useMusicContext`), que provoca el crossfade (AC3/AC4).
 * - Slider: persiste `quizup-volume` y conserva la semántica de US-20
 *   (volumen 0 ⇒ mute; subir desde 0 ⇒ unmute). El fade lee el target vivo,
 *   así que el slider no queda pisado (D-F.1).
 */
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { getMusicPlayer } from "@/adapters/audio/music-player";
import {
  MUSIC_DEFAULT_VOLUME,
  MUSIC_MUTED_STORAGE_KEY,
  MUSIC_VOLUME_MAX_PERCENT,
  MUSIC_VOLUME_MIN_PERCENT,
  MUSIC_VOLUME_STORAGE_KEY,
} from "@/constants/music";
import { useMusicContext } from "./useMusicContext";

export interface UseMusicPlayerResult {
  mounted: boolean;
  muted: boolean;
  volume: number;
  toggleMute(): void;
  handleVolumeChange(event: ChangeEvent<HTMLInputElement>): void;
}

/** Convierte el porcentaje del slider (0..100) a la fracción del player (0..1). */
function toFraction(percent: number): number {
  return percent / MUSIC_VOLUME_MAX_PERCENT;
}

/** Volumen por defecto del slider, en porcentaje. */
const DEFAULT_VOLUME_PERCENT = MUSIC_DEFAULT_VOLUME * MUSIC_VOLUME_MAX_PERCENT;

/** Lee `quizup-volume` (0..100); ausente/inválido cae al default y se acota al rango. */
function readSavedVolume(): number {
  const saved = localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
  if (saved === null) return DEFAULT_VOLUME_PERCENT;

  const parsed = Number(saved);
  if (Number.isNaN(parsed)) return DEFAULT_VOLUME_PERCENT;

  const clamped = Math.min(
    MUSIC_VOLUME_MAX_PERCENT,
    Math.max(MUSIC_VOLUME_MIN_PERCENT, parsed)
  );
  return clamped;
}

/** Lee `quizup-muted`; ausente ⇒ mute (default de US-20). */
function readSavedMuted(): boolean {
  const saved = localStorage.getItem(MUSIC_MUTED_STORAGE_KEY);
  return saved === null ? true : saved === "true";
}

export function useMusicPlayer(): UseMusicPlayerResult {
  const context = useMusicContext();
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME_PERCENT);

  useEffect(() => {
    const player = getMusicPlayer();

    const savedVolume = readSavedVolume();
    player.setTargetVolume(toFraction(savedVolume));
    setVolume(savedVolume);

    const savedMuted = readSavedMuted();
    player.setMuted(savedMuted);
    setMuted(savedMuted);

    setMounted(true);
    void player.play();

    const unlock = () => {
      // El primer gesto crea el mixer (`AudioContext`) y lo reanuda; `play()`
      // reintenta el elemento (best-effort, AC7).
      void player.unlock();
      void player.play();
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };

    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);

    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    getMusicPlayer().setContext(context);
  }, [context]);

  const toggleMute = useCallback(() => {
    const player = getMusicPlayer();
    const nextMuted = !player.isMuted();
    player.setMuted(nextMuted);
    setMuted(nextMuted);
    localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, String(nextMuted));
  }, []);

  const handleVolumeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const player = getMusicPlayer();
      const nextVolume = Number(event.target.value);
      if (Number.isNaN(nextVolume)) return;

      setVolume(nextVolume);
      player.setTargetVolume(toFraction(nextVolume));
      localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(nextVolume));

      if (nextVolume === MUSIC_VOLUME_MIN_PERCENT) {
        player.setMuted(true);
        setMuted(true);
        localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, "true");
      } else if (player.isMuted()) {
        player.setMuted(false);
        setMuted(false);
        localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, "false");
      }
    },
    []
  );

  return { mounted, muted, volume, toggleMute, handleVolumeChange };
}
