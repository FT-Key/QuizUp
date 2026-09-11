"use client";

import { Avatar } from './Avatar';

interface ScoreboardEntry {
  playerId: string;
  name: string;
  score: number;
  previousPosition: number;
  currentPosition: number;
  avatar?: { seed: string; accessories?: string[] };
}

interface ScoreboardProps {
  entries: ScoreboardEntry[];
  currentPlayerId?: string;
}

export function Scoreboard({ entries, currentPlayerId }: ScoreboardProps) {
  const sorted = [...entries].sort((a, b) => a.currentPosition - b.currentPosition);

  return (
    <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 space-y-2">
      <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
        🏆 Posiciones
      </h3>

      {sorted.map((entry, index) => {
        const positionChange = entry.previousPosition - entry.currentPosition;
        const isHappy = positionChange > 0;
        const isSad = positionChange < 0;
        const isCurrentPlayer = entry.playerId === currentPlayerId;

        return (
          <div
            key={entry.playerId}
            className={`
              flex items-center gap-3 p-2 rounded-xl transition-all
              animate-slide-in-right
              ${isCurrentPlayer ? 'bg-purple-500/30 ring-1 ring-purple-400' : ''}
            `}
            style={{ animationDelay: `${index * 80}ms` }}
          >

            <span className="text-white font-bold w-8 text-center text-lg">
              {entry.currentPosition + 1}°
            </span>

            <Avatar
              seed={entry.avatar?.seed || entry.name}
              size={40}
              expression={isHappy ? 'happy' : isSad ? 'sad' : 'neutral'}
              accessories={entry.avatar?.accessories}
            />

            <span className={`text-white font-medium flex-1 truncate ${
              isCurrentPlayer ? 'text-purple-200' : ''
            }`}>
              {entry.name}
              {isCurrentPlayer && <span className="text-xs ml-1">(tú)</span>}
            </span>

            {positionChange !== 0 && (
              <span className={`text-lg font-bold animate-slide-in-up ${
                isHappy ? 'text-green-400' : 'text-red-400'
              }`}>
                {isHappy ? '↑' : '↓'}
                {Math.abs(positionChange)}
              </span>
            )}

            <span className="text-white/80 font-mono text-sm min-w-[60px] text-right">
              {entry.score.toLocaleString()}
            </span>
          </div>
        );
      })}

      <p className="text-white/50 text-xs text-center mt-3">
        Esperando siguiente pregunta...
      </p>
    </div>
  );
}
