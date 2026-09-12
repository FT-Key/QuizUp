"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { QUIZ_FILE_LIMITS } from "@/core/domain/quiz-file"
import { useQuizDraft } from "@/hooks/useQuizDraft"
import { buildCreateGamePayload } from "@/core/application/builders/quiz-builder"
import { QuestionEditor } from "./game-form/QuestionEditor"
import { TimeLimitSelector } from "./game-form/TimeLimitSelector"
import { QuizFileActions } from "./game-form/QuizFileActions"

export function GameForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const {
    draft,
    isValid,
    setName,
    setQuestionTimeLimit,
    addQuestion,
    removeQuestion,
    setQuestionText,
    setOption,
    setCorrectAnswer,
    setQuestionImage,
    importQuiz,
  } = useQuizDraft()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = buildCreateGamePayload(draft)

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

      router.push(`/game/${game.id}/admin`)
    } catch {

      toast.error("Failed to create game. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
          Quiz Name
        </label>
        <input
          id="gameName"
          type="text"
          placeholder="Enter your quiz name..."
          value={draft.name}
          onChange={(e) => setName(e.target.value)}
          maxLength={QUIZ_FILE_LIMITS.maxNameLength}
          className="w-full px-4 py-4 text-lg font-medium border-3 border-gray-200 rounded-2xl focus:border-[#864CBF] focus:ring-4 focus:ring-[#864CBF]/20 transition-all outline-none"
          style={{ borderWidth: "3px" }}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
          Time per Question
        </label>
        <TimeLimitSelector
          value={draft.questionTimeLimit}
          onChange={setQuestionTimeLimit}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-black text-gray-800 uppercase">
            Questions ({draft.questions.length})
          </h2>
          <div className="flex items-center gap-2">

            <QuizFileActions draft={draft} onImport={importQuiz} />

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
        </div>

        {draft.questions.map((question, questionIndex) => (
          <QuestionEditor
            key={questionIndex}
            index={questionIndex}
            question={question}
            canRemove={draft.questions.length > 1}
            onRemove={() => removeQuestion(questionIndex)}
            onTextChange={(text) => setQuestionText(questionIndex, text)}
            onOptionChange={(optionIndex, value) =>
              setOption(questionIndex, optionIndex, value)
            }
            onCorrectAnswerChange={(optionIndex) =>
              setCorrectAnswer(questionIndex, optionIndex)
            }
            onImageChange={(image) => setQuestionImage(questionIndex, image)}
          />
        ))}
      </div>

      <button
        type="submit"
        className="w-full py-5 text-xl font-black text-white rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        style={{
          background: isValid
            ? "linear-gradient(135deg, #E21B3C 0%, #C41834 100%)"
            : "linear-gradient(135deg, #A0A0A0 0%, #808080 100%)",
          boxShadow: isValid ? "0 6px 20px rgba(226, 27, 60, 0.4)" : "none",
        }}
        disabled={!isValid || isLoading}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            Creating Quiz...
          </span>
        ) : (
          `CREATE QUIZ (${draft.questions.length} Question${draft.questions.length !== 1 ? "s" : ""})`
        )}
      </button>
    </form>
  )
}
