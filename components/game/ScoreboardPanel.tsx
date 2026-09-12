"use client";

import { useMemo } from "react";
import { Scoreboard } from "@/components/Scoreboard";
import type { Player } from "@/types";
import type { PreviousLeaderboardEntry } from "@/hooks/useGameSession";

interface ScoreboardPanelProps {
  players: Player[];
  previousLeaderboard: PreviousLeaderboardEntry[];
  currentPlayerId: string;
}

/** Copia literal de `buildLeaderboardEntries` (page.tsx legacy): posiciones previa/actual. */
function buildScoreboardEntries(
  players: Player[],
  previousLeaderboard: PreviousLeaderboardEntry[]
) {
  return players
    .map((p, idx) => {
      const prevIdx = previousLeaderboard.findIndex(
        (pl) => pl.playerId === p.id
      );
      return {
        playerId: p.id,
        name: p.name,
        score: p.score,
        previousPosition: prevIdx >= 0 ? prevIdx : idx,
        currentPosition: idx,
        avatar: p.avatar,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry, idx) => ({
      ...entry,
      currentPosition: idx,
    }));
}

export function ScoreboardPanel({
  players,
  previousLeaderboard,
  currentPlayerId,
}: ScoreboardPanelProps) {
  const entries = useMemo(
    () => buildScoreboardEntries(players, previousLeaderboard),
    [players, previousLeaderboard]
  );

  return (
    <Scoreboard entries={entries} currentPlayerId={currentPlayerId} />
  );
}
