"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2, Check } from "lucide-react"
import type { CreateGameData } from "@/types"

const KAHOOT_COLORS = [
  { bg: "#E21B3C", hover: "#C41834", name: "Red", icon: "▲" },
  { bg: "#1368CE", hover: "#105AB0", name: "Blue", icon: "◆" },
  { bg: "#26890C", hover: "#1E7209", name: "Green", icon: "●" },
  { bg: "#FFC900", hover: "#E0B200", name: "Yellow", icon: "■" },
]

interface QuestionForm {
  text: string
  options: [string, string, string, string]
  correctAnswer: number
}

export function GameForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [gameName, setGameName] = useState("")
  const [questionTimeLimit, setQuestionTimeLimit] = useState(20000)
  const [questions, setQuestions] = useState<QuestionForm[]>([
    {
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
    },
  ])

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
      },
    ])
  }

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (
    index: number,
    field: keyof QuestionForm,
    value: any
  ) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    setQuestions(newQuestions)
  }

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    const newQuestions = [...questions]
    const newOptions = [...newQuestions[questionIndex].options] as [
      string,
      string,
      string,
      string
    ]
    newOptions[optionIndex] = value
    newQuestions[questionIndex] = {
      ...newQuestions[questionIndex],
      options: newOptions,
    }
    setQuestions(newQuestions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData: CreateGameData = {
        name: gameName,
        questionTimeLimit,
        questions: questions,
      }

      const response = await fetch("/api/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to create game")
      }

      const { game } = await response.json()
      console.log("Game response: ", game)
      router.push(`/game/${game.id}/admin`)
    } catch (error) {
      console.error("Error creating game:", error)
      alert("Failed to create game. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    gameName.trim() &&
    questions.every(
      (q) => q.text.trim() && q.options.every((option) => option.trim())
    )

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Game Name */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
          Quiz Name
        </label>
        <input
          id="gameName"
          type="text"
          placeholder="Enter your quiz name..."
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          className="w-full px-4 py-4 text-lg font-medium border-3 border-gray-200 rounded-2xl focus:border-[#864CBF] focus:ring-4 focus:ring-[#864CBF]/20 transition-all outline-none"
          style={{ borderWidth: "3px" }}
          required
        />
      </div>

      {/* Time per Question */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
          Time per Question
        </label>
        <div className="flex bg-gray-100 rounded-2xl p-1">
          {[20000, 30000, 40000].map((time, i) => {
            const isSelected = questionTimeLimit === time;
            return (
              <button
                key={time}
                type="button"
                onClick={() => setQuestionTimeLimit(time)}
                className={`flex-1 py-3 text-base font-bold transition-all ${
                  isSelected
                    ? "bg-white text-[#46178F] shadow-md"
                    : "text-gray-500 hover:text-gray-700"
                } ${
                  i === 0
                    ? "rounded-l-xl"
                    : i === 2
                    ? "rounded-r-xl"
                    : ""
                }`}
              >
                {time / 1000}s
              </button>
            );
          })}
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-800 uppercase">
            Questions ({questions.length})
          </h2>
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #864CBF 0%, #46178F 100%)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add Question
          </button>
        </div>

        {questions.map((question, questionIndex) => (
          <div
            key={questionIndex}
            className="bg-gray-50 rounded-3xl p-6 space-y-5 border-2 border-gray-100"
          >
            {/* Question Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
                  style={{
                    background: KAHOOT_COLORS[questionIndex % 4].bg
                  }}
                >
                  {questionIndex + 1}
                </div>
                <span className="font-bold text-gray-700">Question {questionIndex + 1}</span>
              </div>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(questionIndex)}
                  className="p-2 text-gray-400 hover:text-[#E21B3C] hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Question Text */}
            <textarea
              placeholder="Type your question here..."
              value={question.text}
              onChange={(e) =>
                updateQuestion(questionIndex, "text", e.target.value)
              }
              rows={2}
              className="w-full px-4 py-3 text-base font-medium border-2 border-gray-200 rounded-2xl focus:border-[#1368CE] focus:ring-4 focus:ring-[#1368CE]/20 transition-all outline-none resize-none"
              required
            />

            {/* Answer Options Grid - 2x2 with Kahoot Colors */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                Answer Options
              </label>
              <div className="grid grid-cols-2 gap-3">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: KAHOOT_COLORS[optionIndex].bg,
                    }}
                  >
                    {/* Correct Answer Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        updateQuestion(questionIndex, "correctAnswer", optionIndex)
                      }
                      className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 ${
                        question.correctAnswer === optionIndex
                          ? "bg-white text-[#26890C] scale-110"
                          : "bg-black/20 text-white/70 hover:bg-black/30"
                      }`}
                      title="Mark as correct answer"
                    >
                      <Check className="h-5 w-5" />
                    </button>

                    {/* Shape Icon */}
                    <div className="text-4xl text-white/90 pt-3 pl-3">
                      {KAHOOT_COLORS[optionIndex].icon}
                    </div>

                    {/* Option Input */}
                    <div className="p-3 pt-1">
                      <input
                        type="text"
                        placeholder={KAHOOT_COLORS[optionIndex].name}
                        value={option}
                        onChange={(e) =>
                          updateOption(questionIndex, optionIndex, e.target.value)
                        }
                        className="w-full px-3 py-2 text-base font-bold text-white placeholder-white/60 bg-black/20 rounded-xl border-2 border-white/30 focus:border-white focus:ring-2 focus:ring-white/50 transition-all outline-none"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Correct Answer Indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div 
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: KAHOOT_COLORS[question.correctAnswer].bg }}
              >
                <Check className="h-3 w-3 text-white" />
              </div>
              <span>
                Correct answer: <strong>{KAHOOT_COLORS[question.correctAnswer].name}</strong>
                {question.options[question.correctAnswer] && (
                  <span className="text-gray-500"> - {question.options[question.correctAnswer]}</span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full py-5 text-xl font-black text-white rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        style={{
          background: isFormValid
            ? "linear-gradient(135deg, #E21B3C 0%, #C41834 100%)"
            : "linear-gradient(135deg, #A0A0A0 0%, #808080 100%)",
          boxShadow: isFormValid ? "0 6px 20px rgba(226, 27, 60, 0.4)" : "none",
        }}
        disabled={!isFormValid || isLoading}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            Creating Quiz...
          </span>
        ) : (
          `CREATE QUIZ (${questions.length} Question${questions.length !== 1 ? "s" : ""})`
        )}
      </button>
    </form>
  )
}
