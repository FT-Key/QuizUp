"use client";

import React, { useRef, useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.4;

    const tryPlay = () => {
      if (!started) {
        audio.play().then(() => setStarted(true)).catch(() => {});
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
  }, [started]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  return (
    <>
      <audio ref={audioRef} src="/QuizUp.mp3" loop preload="auto" />
      <button
        onClick={toggleMute}
        className="fixed bottom-5 right-5 z-50 bg-white/20 backdrop-blur-md text-white p-3 rounded-full shadow-lg hover:bg-white/30 transition-all border border-white/20"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
