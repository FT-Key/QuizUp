"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import type { Question } from "@/types"

interface QuestionCardProps {
  question: Question
  onAnswerSubmit: (answerIndex: number) => void
}

export function QuestionCard({ question, onAnswerSubmit }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (selectedAnswer === null) return

    setIsSubmitting(true)
    try {
      await onAnswerSubmit(selectedAnswer)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Question</CardTitle>
        <CardDescription>Choose the best answer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question Text */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-lg font-medium text-gray-900 dark:text-white">{question.text}</p>
        </div>

        {/* Answer Options */}
        <RadioGroup
          value={selectedAnswer?.toString() || ""}
          onValueChange={(value) => setSelectedAnswer(Number.parseInt(value))}
        >
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  selectedAnswer === index ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value={index.toString()} id={`answer-${index}`} />
                    <Label htmlFor={`answer-${index}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-base">{option}</span>
                      </div>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </RadioGroup>

        {/* Submit Button */}
        <Button onClick={handleSubmit} disabled={selectedAnswer === null || isSubmitting} className="w-full" size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting Answer...
            </>
          ) : (
            "Submit Answer"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
