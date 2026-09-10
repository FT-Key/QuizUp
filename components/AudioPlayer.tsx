"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Singleton audio element — lives outside React so it survives navigation
let audioInstance: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioInstance) {
    audioInstance = new Audio("/QuizUp.mp3");
    audioInstance.loop = true;
    audioInstance.preload = "auto";
    audioInstance.volume = 0.4;
  }
  return audioInstance;
}

export function AudioPlayer() {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(40);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const audio = getAudio();

    const tryPlay = () => {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    };

    tryPlay();

    const handleInteraction = () => {
      tryPlay();
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  const toggleMute = useCallback(() => {
    const audio = getAudio();
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = getAudio();
    const val = Number(e.target.value);
    audio.volume = val / 100;
    setVolume(val);
    if (val === 0) {
      audio.muted = true;
      setMuted(true);
    } else if (audio.muted) {
      audio.muted = false;
      setMuted(false);
    }
  }, []);

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Volume slider — appears on hover */}
      <div
        className={`flex items-center bg-white/20 backdrop-blur-md rounded-full px-1 py-1 border border-white/20 shadow-lg transition-all duration-300 overflow-hidden ${
          hovered ? "opacity-100 w-28" : "opacity-0 w-0"
        }`}
      >
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={handleVolumeChange}
          className="w-full h-1 accent-white cursor-pointer"
        />
      </div>

      {/* Mute/unmute button */}
      <button
        onClick={toggleMute}
        className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full shadow-lg hover:bg-white/30 transition-all border border-white/20 flex-shrink-0"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
