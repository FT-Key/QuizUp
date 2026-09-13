import type { MusicContext } from "@/core/domain/music/music-context";

/**
 * Playlist por contexto. Añadir una canción = copiar el mp3 a `public/music/`
 * y sumar su ruta aquí; ningún otro cambio de código (AC2).
 */
export const MUSIC_PLAYLISTS = {
  queue: ["/music/QueueUp.mp3", "/music/QueueUp2.mp3"],
  game: ["/music/QuizUp.mp3", "/music/QuizUp2.mp3"],
} as const satisfies Record<MusicContext, readonly string[]>;

/** Duración de CADA rampa del fade (out y, luego, in), en ms. US-23: 1,5 s. */
export const MUSIC_FADE_MS = 1500;

/** Paso del fade; nº de ticks por rampa = MUSIC_FADE_MS / MUSIC_FADE_STEP_MS = 30. */
export const MUSIC_FADE_STEP_MS = 50;

/** Volumen objetivo por defecto (0..1) = 40 %. */
export const MUSIC_DEFAULT_VOLUME = 0.4;

/** Rango del slider de volumen en porcentaje (0..100); el player usa fracción 0..1. */
export const MUSIC_VOLUME_MIN_PERCENT = 0;
export const MUSIC_VOLUME_MAX_PERCENT = 100;

/** Clave de localStorage del slider (0..100). */
export const MUSIC_VOLUME_STORAGE_KEY = "quizup-volume";

/** Clave de localStorage del mute ("true" | "false"). */
export const MUSIC_MUTED_STORAGE_KEY = "quizup-muted";
