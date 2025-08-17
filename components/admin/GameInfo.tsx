"use client";

import { useState } from "react";
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
  game: any;
  timeLeft: number;
  questionEnded: boolean;
}

export const GameInfo = ({ game, timeLeft, questionEnded }: Props) => {
  const [copied, setCopied] = useState(false);

  const currentQuestion = game.questions[game.currentQuestionIndex];
  const playersWithAnswers = game.players.filter(
    (p: any) => p.answers?.[currentQuestion?.id] !== undefined
  ).length;

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
          <span>Game ID:</span>
          <div className="flex items-center gap-2">
            <code>{game.id}</code>
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
