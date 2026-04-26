"use client"

import type { Question } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface QuestionCardProps {
  question: Question
  onAnswerSubmit: (answerIndex: number) => void
  disabled?: boolean
  timeLeft?: number
  timeLimit?: number
}

export function QuestionCard({ question, onAnswerSubmit, disabled = false, timeLeft, timeLimit }: QuestionCardProps) {
  const progressPct = timeLeft !== undefined && timeLimit ? Math.max(0, (timeLeft / timeLimit) * 100) : undefined
  const timeLeftSec = timeLeft !== undefined ? Math.ceil(timeLeft / 1000) : undefined

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Question</CardTitle>
          {timeLeftSec !== undefined && (
            <span className={`text-2xl font-bold tabular-nums ${timeLeftSec <= 5 ? "text-red-500" : "text-gray-700 dark:text-gray-200"}`}>
              {timeLeftSec}s
            </span>
          )}
        </div>
        {progressPct !== undefined && (
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-100 ${progressPct <= 20 ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-lg font-medium text-gray-900 dark:text-white">{question.text}</p>
        </div>

        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              disabled={disabled}
              onClick={() => onAnswerSubmit(index)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors flex items-center space-x-3
                ${disabled
                  ? "opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700"
                  : "cursor-pointer border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-[0.99]"
                }`}
            >
              <span className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-base">{option}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
