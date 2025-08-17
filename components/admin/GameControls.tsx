"use client";

import { Button } from "@/components/ui/button";
import { Play, Square, SkipForward, PauseCircle, Loader2 } from "lucide-react";

interface Props {
  gameStatus: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  isStarting: boolean;
  isFinishing: boolean;
  questionEnded: boolean;
  onStart: () => void;
  onFinish: () => void;
  onNextQuestion: () => void;
  onForceEnd: () => void;
  hasPlayers: boolean;
}

export function GameControls({
  gameStatus,
  currentQuestionIndex,
  totalQuestions,
  isStarting,
  isFinishing,
  questionEnded,
  onStart,
  onFinish,
  onNextQuestion,
  onForceEnd,
  hasPlayers,
}: Props) {
  if (gameStatus === "waiting") {
    return (
      <Button
        onClick={onStart}
        disabled={isStarting || !hasPlayers}
        className="w-full cursor-pointer"
      >
        {isStarting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting Game...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Start Game
          </>
        )}
      </Button>
    );
  }

  if (gameStatus === "active") {
    if (!questionEnded) {
      return (
        <Button onClick={onForceEnd} variant="destructive" className="w-full">
          <PauseCircle className="mr-2 h-4 w-4" />
          Finalizar pregunta
        </Button>
      );
    } else {
      if (currentQuestionIndex < totalQuestions - 1) {
        return (
          <Button onClick={onNextQuestion} className="w-full">
            <SkipForward className="mr-2 h-4 w-4" />
            Siguiente pregunta
          </Button>
        );
      } else {
        return (
          <Button
            onClick={onFinish}
            disabled={isFinishing}
            variant="destructive"
            className="w-full"
          >
            {isFinishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finishing Game...
              </>
            ) : (
              <>
                <Square className="mr-2 h-4 w-4" />
                Finish Game
              </>
            )}
          </Button>
        );
      }
    }
  }

  return null;
}
