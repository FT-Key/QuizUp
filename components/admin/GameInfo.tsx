"use client";

import { useState } from "react";
import { Game, Player, Question } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clipboard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  game: Game;
  timeLeft: number;
  questionEnded: boolean;
}

export const GameInfo = ({ game, timeLeft, questionEnded }: Props) => {
  const [copied, setCopied] = useState(false);

  const currentQuestion: Question | undefined =
    game.questions[game.currentQuestionIndex];
  const playersWithAnswers = currentQuestion
    ? game.players.filter(
        (p: Player) => p.answers?.[currentQuestion.id] !== undefined
      ).length
    : 0;

  const handleCopyId = () => {
    navigator.clipboard.writeText(game.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game Information</CardTitle>
        <CardDescription>Current game status and details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Game Code:</span>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-black tracking-[0.2em] text-[#46178F]">
              {game.id}
            </code>
            <Button size="sm" variant="outline" onClick={handleCopyId}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Clipboard className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span>Status:</span>
          <Badge>{game.status}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <span>Players:</span>
          <span>{game.players.length}</span>
        </div>

        {game.status === "active" && currentQuestion && (
          <>
            <div className="flex items-center justify-between">
              <span>Answers Submitted:</span>
              <span>
                {playersWithAnswers} / {game.players.length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Time Left:</span>
              <span>{(timeLeft / 1000).toFixed(1)}s</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
