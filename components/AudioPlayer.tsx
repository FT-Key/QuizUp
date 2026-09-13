"use client";

/**
 * US-22 — Control de audio flotante (US-20): UI fina.
 *
 * Conserva el markup, las clases, el `aria-label`, el popup y el slider
 * vertical, además del estado puramente visual `expanded`. Toda la lógica de
 * audio (contexto/playlists, crossfade, autoplay, volumen/mute y persistencia)
 * vive en `useMusicPlayer`.
 *
 * US-23, H1 — apertura del panel:
 * - Con puntero (`mouse`) el panel se abre al entrar al control completo
 *   (`[data-volume-control]`: botón + panel) y se cierra al salir, para que el
 *   slider siga usable mientras el puntero está dentro. El click sigue
 *   alternando mute.
 * - En táctil/pluma el hover no existe: el tap (`pointerdown`) alterna el panel;
 *   el `click` del botón sigue alternando mute.
 */
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  MUSIC_VOLUME_MAX_PERCENT,
  MUSIC_VOLUME_MIN_PERCENT,
} from "@/constants/music";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";

export function AudioPlayer() {
  const { mounted, muted, volume, toggleMute, handleVolumeChange } =
    useMusicPlayer();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-volume-control]')) {
        setExpanded(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [expanded]);

  if (!mounted) return null;

  return (
    <div
      data-volume-control
      className="fixed bottom-5 right-5 z-50 flex flex-col-reverse items-center gap-2"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        onClick={toggleMute}
        onPointerDown={(e) => {
          e.stopPropagation();
          // Con mouse el panel lo gobierna el hover; en táctil/pluma, el tap.
          if (e.pointerType !== "mouse") {
            setExpanded((prev) => !prev);
          }
        }}
        className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full shadow-lg hover:bg-white/30 active:bg-white/40 transition-all border border-white/20"
        aria-label={muted ? "Unmute" : "Mute"}
        aria-expanded={expanded}
      >
        {muted ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>

      <div
        className={`flex flex-col items-center bg-white/20 backdrop-blur-md rounded-full border border-white/20 shadow-lg transition-all duration-300 overflow-hidden ${
          expanded ? "opacity-100 h-32 py-2" : "opacity-0 h-0"
        }`}
      >
        <input
          type="range"
          min={MUSIC_VOLUME_MIN_PERCENT}
          max={MUSIC_VOLUME_MAX_PERCENT}
          value={volume}
          onChange={handleVolumeChange}
          className="w-10 h-24 cursor-pointer"
          style={{
            writingMode: "vertical-lr",
            direction: "rtl",
            WebkitAppearance: "slider-vertical"
          }}
        />
      </div>
    </div>
  );
}
