"use client";

import { Loader2 } from "lucide-react";
import { QuestionCard } from "@/components/QuestionCard";
import type { Question } from "@/types";

const WAITING_MESSAGE = "Esperando respuestas de los demás jugadores…";

interface AnswerPanelProps {
  question: Question | null;
  hasSubmitted: boolean;
  isQuestionFinished: boolean;
  onAnswerSubmit: (answerIndex: number) => void;
}

export function AnswerPanel({
  question,
  hasSubmitted,
  isQuestionFinished,
  onAnswerSubmit,
}: AnswerPanelProps) {
  // Si ya envió, se muestra la espera aunque `isQuestionFinished` sea true: el
  // hook marca `allAnswered` en `game-updated` antes de que `question-finished`
  // cambie la fase a `showing-result`; si no, el área queda en blanco un tick.
  if (hasSubmitted) {
    return (
      <div
        className="bg-white rounded-3xl shadow-xl p-8 text-center"
        style={{ animation: "bounce-in 0.4s ease-out" }}
      >
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-[#864CBF]" />
        <p className="text-lg sm:text-xl font-bold text-gray-800 mt-4">
          {WAITING_MESSAGE}
        </p>
      </div>
    );
  }

  if (isQuestionFinished || !question) return null;

  return <QuestionCard question={question} onAnswerSubmit={onAnswerSubmit} />;
}
