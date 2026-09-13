"use client"

import { useState, useCallback } from "react"
import type { Question } from "@/types"
import { KAHOOT_COLORS, OPTION_ICONS } from "@/constants/option-colors"

/** Orden del jugador: Red, Blue, Green, Yellow (invertido 2↔3 vs. admin). */
const OPTION_COLORS = [
  KAHOOT_COLORS.red,
  KAHOOT_COLORS.blue,
  KAHOOT_COLORS.green,
  KAHOOT_COLORS.yellow,
]

interface QuestionCardProps {
  question: Question
  onAnswerSubmit: (answerIndex: number) => void
}

export function QuestionCard({ question, onAnswerSubmit }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)

  const handleSelect = useCallback((index: number) => {
    if (selectedAnswer !== null) return

    setSelectedAnswer(index)
    onAnswerSubmit(index)
  }, [selectedAnswer, onAnswerSubmit])

  return (
    <div className="space-y-3 sm:space-y-6">

      <div
        className="bg-white rounded-3xl shadow-xl p-3 sm:p-8 text-center"
        style={{ animation: "bounce-in 0.5s ease-out" }}
      >
        {question.image?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.image.url}
            alt={question.image.alt || "Imagen de la pregunta"}
            className="w-full max-h-28 sm:max-h-64 object-contain rounded-2xl mb-2 sm:mb-4 mx-auto"
          />
        )}
        <p className="text-lg sm:text-2xl md:text-3xl font-black text-gray-800 leading-tight">
          {question.text}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={selectedAnswer !== null}
            className={`
              relative rounded-2xl sm:rounded-3xl p-3 sm:p-6 min-h-[84px] sm:min-h-[140px] flex flex-col items-center justify-center text-center
              transition-all duration-200
              ${selectedAnswer === index
                ? "scale-95 ring-4 ring-white shadow-2xl"
                : selectedAnswer !== null
                  ? "opacity-50 scale-95"
                  : "hover:scale-[1.03] hover:shadow-xl active:scale-95"
              }
            `}
            style={{
              backgroundColor: OPTION_COLORS[index].bg,
              animation: selectedAnswer === null ? `bounce-in ${0.3 + index * 0.1}s ease-out` : "none",
            }}
          >

            <span className="text-3xl sm:text-5xl md:text-6xl text-white/90 mb-1 sm:mb-2">
              {OPTION_ICONS[index]}
            </span>

            <span className="text-sm sm:text-lg md:text-xl font-bold text-white leading-tight line-clamp-2 break-words">
              {option}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
