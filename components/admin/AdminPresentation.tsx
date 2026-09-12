"use client";

import { AnswerChart } from "./AnswerChart";
import { Loader2, PauseCircle, SkipForward, Square } from "lucide-react";
import type { Game } from "@/types";
import { KAHOOT_COLORS, OPTION_ICONS } from "@/constants/option-colors";

/** Orden del admin: Red, Blue, Yellow, Green (invertido 2↔3 vs. jugador/creador). */
const OPTION_STYLES = [
  { bg: KAHOOT_COLORS.red.bg, shape: OPTION_ICONS[0], text: "text-white" },
  { bg: KAHOOT_COLORS.blue.bg, shape: OPTION_ICONS[1], text: "text-white" },
  { bg: KAHOOT_COLORS.yellow.bg, shape: OPTION_ICONS[2], text: "text-gray-900" },
  { bg: KAHOOT_COLORS.green.bg, shape: OPTION_ICONS[3], text: "text-white" },
];

interface AdminPresentationProps {
  game: Game;
  timeLeft: number;
  questionEnded: boolean;
  isFinishing: boolean;
  onForceEnd: () => void;
  onNextQuestion: () => void;
  onFinish: () => void;
}

export function AdminPresentation({
  game,
  timeLeft,
  questionEnded,
  isFinishing,
  onForceEnd,
  onNextQuestion,
  onFinish,
}: AdminPresentationProps) {
  const question = game.questions[game.currentQuestionIndex];

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white text-xl font-bold">Preparando pregunta...</p>
      </div>
    );
  }

  const totalPlayers = game.players.length;
  const answered = game.players.filter(
    (p) => p.answers?.[question.id] !== undefined
  ).length;

  const counts = [0, 1, 2, 3].map(
    (index) =>
      game.players.filter((p) => p.answers?.[question.id] === index).length
  );

  const timeLimit = game.questionTimeLimit || 30000;
  const timePct = questionEnded
    ? 0
    : Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100));

  const timeColor =
    timePct > 50 ? "#26890C" : timePct > 20 ? "#FFC900" : "#E21B3C";

  const isLastQuestion = game.currentQuestionIndex >= game.questions.length - 1;

  return (
    <div className="min-h-screen flex flex-col p-3 md:p-8">

      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="bg-white/15 backdrop-blur-sm text-white font-bold rounded-full px-4 py-1.5 text-sm md:text-lg">
          Pregunta {game.currentQuestionIndex + 1} / {game.questions.length}
        </span>
        <span className="hidden md:block text-white/70 font-medium truncate">
          {game.name}
        </span>
        <span className="bg-white/15 backdrop-blur-sm text-white font-bold rounded-full px-4 py-1.5 text-sm md:text-lg">
          {answered} / {totalPlayers} respondieron
        </span>
      </div>

      <div className="h-3 bg-white/20 rounded-full overflow-hidden mb-6">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300 ease-linear"
          style={{ width: `${timePct}%`, backgroundColor: timeColor }}
        />
      </div>

      <h1 className="text-2xl md:text-5xl font-black text-white text-center mb-4 md:mb-6 drop-shadow-lg px-2">
        {question.text}
      </h1>

      {question.image?.url && (
        <div className="flex justify-center mb-5 md:mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.image.url}
            alt={question.image.alt || "Imagen de la pregunta"}
            className="max-h-40 md:max-h-64 rounded-3xl shadow-2xl object-contain"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {question.options.map((option, index) => {
          const style = OPTION_STYLES[index] ?? OPTION_STYLES[0];
          const isCorrect = questionEnded && index === question.correctAnswer;
          const dimmed = questionEnded && index !== question.correctAnswer;

          return (
            <div
              key={index}
              className={`
                flex items-center gap-3 md:gap-4 p-4 md:p-6 rounded-2xl shadow-lg
                transition-all duration-500
                ${dimmed ? "opacity-40 saturate-50" : ""}
                ${isCorrect ? "ring-4 ring-white scale-[1.02]" : ""}
              `}
              style={{ backgroundColor: style.bg }}
            >
              <span className={`text-2xl md:text-4xl flex-shrink-0 ${style.text}`}>
                {style.shape}
              </span>
              <span className={`text-lg md:text-3xl font-bold flex-1 ${style.text}`}>
                {option}
              </span>
              {isCorrect && (
                <span className="text-2xl md:text-4xl text-white font-black">✓</span>
              )}
            </div>
          );
        })}
      </div>

      {questionEnded && (
        <div className="mt-6 animate-slide-in-up">
          <AnswerChart
            options={question.options}
            counts={counts}
            correctIndex={question.correctAnswer}
          />
        </div>
      )}

      <div className="mt-6 flex justify-center pb-4">
        {!questionEnded ? (
          <button
            onClick={onForceEnd}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl text-lg md:text-xl font-black text-white transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #E21B3C 0%, #B3162F 100%)",
              boxShadow: "0 6px 20px rgba(226, 27, 60, 0.45)",
            }}
          >
            <PauseCircle className="h-6 w-6" />
            Terminar pregunta
          </button>
        ) : isLastQuestion ? (
          <button
            onClick={onFinish}
            disabled={isFinishing}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl text-lg md:text-xl font-black text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            style={{
              background: "linear-gradient(135deg, #864CBF 0%, #46178F 100%)",
              boxShadow: "0 6px 20px rgba(70, 23, 143, 0.45)",
            }}
          >
            {isFinishing ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <Square className="h-6 w-6" />
                Finalizar juego 🏆
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onNextQuestion}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl text-lg md:text-xl font-black text-white transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
              boxShadow: "0 6px 20px rgba(19, 104, 206, 0.45)",
            }}
          >
            <SkipForward className="h-6 w-6" />
            Siguiente pregunta
          </button>
        )}
      </div>
    </div>
  );
}
