"use client"

import { useState, useCallback } from "react"
import type { Question } from "@/types"

const KAHOOT_COLORS = [
  { bg: "#E21B3C", name: "Red", icon: "▲" },
  { bg: "#1368CE", name: "Blue", icon: "◆" },
  { bg: "#26890C", name: "Green", icon: "●" },
  { bg: "#FFC900", name: "Yellow", icon: "■" },
]

interface QuestionCardProps {
  question: Question
  onAnswerSubmit: (answerIndex: number) => void
}

export function QuestionCard({ question, onAnswerSubmit }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSelect = useCallback(async (index: number) => {
    if (selectedAnswer !== null || isSubmitting) return

    setSelectedAnswer(index)
    setIsSubmitting(true)

    try {
      await onAnswerSubmit(index)
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedAnswer, isSubmitting, onAnswerSubmit])

  return (
    <div className="space-y-6">

      <div
        className="bg-white rounded-3xl shadow-xl p-4 sm:p-8 text-center"
        style={{ animation: "bounce-in 0.5s ease-out" }}
      >
        {question.image?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.image.url}
            alt={question.image.alt || "Imagen de la pregunta"}
            className="w-full max-h-52 sm:max-h-64 object-contain rounded-2xl mb-4 mx-auto"
          />
        )}
        <p className="text-2xl md:text-3xl font-black text-gray-800 leading-tight">
          {question.text}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={selectedAnswer !== null}
            className={`
              relative rounded-3xl p-5 sm:p-6 min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center text-center
              transition-all duration-200
              ${selectedAnswer === index
                ? "scale-95 ring-4 ring-white shadow-2xl"
                : selectedAnswer !== null
                  ? "opacity-50 scale-95"
                  : "hover:scale-[1.03] hover:shadow-xl active:scale-95"
              }
              ${isSubmitting && selectedAnswer === index ? "animate-pulse" : ""}
            `}
            style={{
              backgroundColor: KAHOOT_COLORS[index].bg,
              animation: selectedAnswer === null ? `bounce-in ${0.3 + index * 0.1}s ease-out` : "none",
            }}
          >

            <span className="text-5xl md:text-6xl text-white/90 mb-2">
              {KAHOOT_COLORS[index].icon}
            </span>

            <span className="text-lg md:text-xl font-bold text-white leading-tight">
              {option}
            </span>

            {selectedAnswer === index && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-3xl">
                <div className="bg-white rounded-full p-4">
                  <svg className="h-10 w-10 text-[#26890C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {isSubmitting && (
        <div className="text-center text-white font-bold text-lg">
          Sending your answer...
        </div>
      )}
    </div>
  )
}
