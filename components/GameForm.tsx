"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { CreateGameData } from "@/types";

interface QuestionForm {
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
}

export function GameForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [gameName, setGameName] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([
    {
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
    },
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (
    index: number,
    field: keyof QuestionForm,
    value: any
  ) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    const newQuestions = [...questions];
    const newOptions = [...newQuestions[questionIndex].options] as [
      string,
      string,
      string,
      string
    ];
    newOptions[optionIndex] = value;
    newQuestions[questionIndex] = {
      ...newQuestions[questionIndex],
      options: newOptions,
    };
    setQuestions(newQuestions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData: CreateGameData = {
        name: gameName,
        questions: questions,
      };

      const response = await fetch("/api/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to create game");
      }

      const { game } = await response.json();
      console.log("Game response: ", game);
      router.push(`/game/${game.id}/admin`);
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    gameName.trim() &&
    questions.every(
      (q) => q.text.trim() && q.options.every((option) => option.trim())
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Game Name */}
      <div className="space-y-2">
        <Label htmlFor="gameName">Quiz Name</Label>
        <Input
          id="gameName"
          type="text"
          placeholder="Enter your quiz name..."
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          required
        />
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold">
            Questions ({questions.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addQuestion}
            className="flex items-center gap-2 bg-transparent"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>

        {questions.map((question, questionIndex) => (
          <Card key={questionIndex} className="relative">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Question {questionIndex + 1}
                </CardTitle>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(questionIndex)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Question Text */}
              <div className="space-y-2">
                <Label htmlFor={`question-${questionIndex}`}>Question</Label>
                <Textarea
                  id={`question-${questionIndex}`}
                  placeholder="Enter your question..."
                  value={question.text}
                  onChange={(e) =>
                    updateQuestion(questionIndex, "text", e.target.value)
                  }
                  rows={2}
                  required
                />
              </div>

              {/* Answer Options */}
              <div className="space-y-3">
                <Label>Answer Options</Label>
                <div className="grid gap-2">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className="flex items-center space-x-3"
                    >
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <Input
                        type="text"
                        placeholder={`Option ${String.fromCharCode(
                          65 + optionIndex
                        )}`}
                        value={option}
                        onChange={(e) =>
                          updateOption(
                            questionIndex,
                            optionIndex,
                            e.target.value
                          )
                        }
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Correct Answer Selection */}
              <div className="space-y-3">
                <Label>Correct Answer</Label>
                <RadioGroup
                  value={question.correctAnswer.toString()}
                  onValueChange={(value) =>
                    updateQuestion(
                      questionIndex,
                      "correctAnswer",
                      Number.parseInt(value)
                    )
                  }
                >
                  <div className="grid grid-cols-2 gap-2">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className="flex items-center space-x-2 p-2 border rounded-lg"
                      >
                        <RadioGroupItem
                          value={optionIndex.toString()}
                          id={`q${questionIndex}-option-${optionIndex}`}
                        />
                        <Label
                          htmlFor={`q${questionIndex}-option-${optionIndex}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <span className="font-medium">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          {option && (
                            <span className="block text-xs text-gray-600 dark:text-gray-400 truncate">
                              {option}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={!isFormValid || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Quiz...
          </>
        ) : (
          `Create Quiz with ${questions.length} Question${
            questions.length !== 1 ? "s" : ""
          }`
        )}
      </Button>
    </form>
  );
}
