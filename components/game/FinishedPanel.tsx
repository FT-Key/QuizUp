"use client";

import { Results } from "@/components/Results";
import type { GameResults } from "@/types";

interface FinishedPanelProps {
  gameId: string;
  results: GameResults | null;
}

export function FinishedPanel({ gameId, results }: FinishedPanelProps) {
  return <Results gameId={gameId} results={results} />;
}
