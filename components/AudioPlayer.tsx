"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

let audioInstance: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioInstance) {
    audioInstance = new Audio("/QuizUp.mp3");
    audioInstance.loop = true;
    audioInstance.preload = "auto";

    const savedVolume = localStorage.getItem("quizup-volume");
    const savedMuted = localStorage.getItem("quizup-muted");

    audioInstance.volume = savedVolume !== null ? Number(savedVolume) / 100 : 0.4;
    audioInstance.muted = savedMuted !== null ? savedMuted === "true" : true;
  }
  return audioInstance;
}

export function AudioPlayer() {
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(40);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    const savedVolume = localStorage.getItem("quizup-volume");
    const savedMuted = localStorage.getItem("quizup-muted");

    if (savedVolume !== null) {
      const v = Number(savedVolume);
      audio.volume = v / 100;
      setVolume(v);
    }
    if (savedMuted !== null) {
      const m = savedMuted === "true";
      audio.muted = m;
      setMuted(m);
    }

    setMounted(true);

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
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    localStorage.setItem("quizup-muted", String(audio.muted));
  }, []);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = getAudio();
      if (!audio) return;
      const val = Number(e.target.value);
      audio.volume = val / 100;
      setVolume(val);
      localStorage.setItem("quizup-volume", String(val));
      if (val === 0) {
        audio.muted = true;
        setMuted(true);
        localStorage.setItem("quizup-muted", "true");
      } else if (audio.muted) {
        audio.muted = false;
        setMuted(false);
        localStorage.setItem("quizup-muted", "false");
      }
    },
    []
  );

  if (!mounted) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col-reverse items-center gap-2"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        onClick={toggleMute}
        onPointerDown={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full shadow-lg hover:bg-white/30 active:bg-white/40 transition-all border border-white/20"
        aria-label={muted ? "Unmute" : "Mute"}
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
          min={0}
          max={100}
          value={volume}
          onChange={handleVolumeChange}
          className="w-24 h-24 cursor-pointer"
          style={{
            writingMode: "vertical-lr",
            direction: "rtl",
            WebkitAppearance: "slider-vertical",
            appearance: "slider-vertical",
          }}
        />
      </div>
    </div>
  );
}
