"use client";

import { useState } from "react";
import { AvatarSelector } from "@/components/AvatarSelector";
import { usePlayerSession } from "@/hooks/usePlayerSession";
import type { JoinGamePayload } from "@/hooks/useGameSession";

interface PlayerJoinFormProps {
  onJoin: (payload: JoinGamePayload) => void;
}

export function PlayerJoinForm({ onJoin }: PlayerJoinFormProps) {
  const session = usePlayerSession();
  const [name, setName] = useState<string>(() => {
    return session.get("playerName") ?? "";
  });
  const [avatarSeed, setAvatarSeed] = useState<string>("");
  const [avatarAccessories, setAvatarAccessories] = useState<string[]>([]);
  const [joinStep, setJoinStep] = useState<"name" | "avatar">("name");

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setJoinStep("avatar");
  };

  const handleJoin = () => {
    onJoin({
      playerName: name.trim(),
      avatarSeed,
      avatarAccessories,
    });
  };

  if (joinStep === "avatar") {
    return (
      <div className="space-y-4">
        <AvatarSelector
          playerName={name}
          onSelect={(seed, accessories) => {
            setAvatarSeed(seed);
            if (accessories) setAvatarAccessories(accessories);
          }}
          initialSeed={avatarSeed || name}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setJoinStep("name")}
            className="px-6 py-4 text-lg font-bold text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #666 0%, #444 100%)",
            }}
          >
            Atrás
          </button>
          <button
            type="button"
            onClick={handleJoin}
            className="flex-1 py-4 text-lg font-black text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
            style={{
              background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
              boxShadow: "0 6px 20px rgba(19, 104, 206, 0.4)",
            }}
          >
            JOIN GAME
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleNameSubmit} className="space-y-4">
      <label className="block text-sm font-bold text-white uppercase tracking-wide">
        Your Name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-3 text-lg font-medium border-3 border-white/30 rounded-2xl bg-white/20 text-white placeholder-white/60 focus:border-white focus:ring-4 focus:ring-white/30 transition-all outline-none"
        style={{ borderWidth: "3px" }}
        placeholder="Enter a display name..."
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="w-full py-4 text-lg font-black text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        style={{
          background: name.trim()
            ? "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)"
            : "linear-gradient(135deg, #666 0%, #444 100%)",
          boxShadow: name.trim()
            ? "0 6px 20px rgba(19, 104, 206, 0.4)"
            : "none",
        }}
      >
        SIGUIENTE
      </button>
    </form>
  );
}
