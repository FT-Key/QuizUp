"use client";

import { QuestionCard } from "@/components/QuestionCard";
import type { Question } from "@/types";

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
  if (hasSubmitted) {
    return (
      <div
        className="bg-white rounded-3xl shadow-xl p-8 text-center"
        style={{ animation: "bounce-in 0.4s ease-out" }}
      >
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xl font-bold text-gray-800">
          ¡Respuesta enviada!
        </p>
        <p className="text-gray-500 mt-2">
          Esperando a los demás jugadores...
        </p>
      </div>
    );
  }

  if (isQuestionFinished || !question) return null;

  return <QuestionCard question={question} onAnswerSubmit={onAnswerSubmit} />;
}
