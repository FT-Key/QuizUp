"use client";

import { useState } from "react";
import type { QuestionImage } from "@/types";
import type { SanitizedQuiz } from "@/core/domain/quiz-file";
import {
  createEmptyQuestion,
  createEmptyQuizDraft,
  isValidDraft,
  type QuizDraft,
  type QuizDraftQuestion,
} from "@/core/application/builders/quiz-builder";

export interface QuizDraftController {
  draft: QuizDraft;
  isValid: boolean;
  setName(name: string): void;
  setQuestionTimeLimit(ms: number): void;
  addQuestion(): void;
  removeQuestion(index: number): void;
  setQuestionText(questionIndex: number, text: string): void;
  setOption(questionIndex: number, optionIndex: number, value: string): void;
  setCorrectAnswer(questionIndex: number, optionIndex: number): void;
  setQuestionImage(questionIndex: number, image: QuestionImage | null): void;
  importQuiz(quiz: SanitizedQuiz): void;
}

export function useQuizDraft(): QuizDraftController {
  const [draft, setDraft] = useState<QuizDraft>(createEmptyQuizDraft);

  const updateQuestion = (
    questionIndex: number,
    updater: (question: QuizDraftQuestion) => QuizDraftQuestion
  ) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex ? updater(question) : question
      ),
    }));
  };

  const setName = (name: string) =>
    setDraft((prev) => ({ ...prev, name }));

  const setQuestionTimeLimit = (ms: number) =>
    setDraft((prev) => ({ ...prev, questionTimeLimit: ms }));

  const addQuestion = () =>
    setDraft((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion()],
    }));

  const removeQuestion = (index: number) =>
    setDraft((prev) =>
      prev.questions.length > 1 // guard caracterizado
        ? { ...prev, questions: prev.questions.filter((_, i) => i !== index) }
        : prev
    );

  const setQuestionText = (questionIndex: number, text: string) =>
    updateQuestion(questionIndex, (question) => ({ ...question, text }));

  const setOption = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) =>
    updateQuestion(questionIndex, (question) => {
      const options = [...question.options] as [
        string,
        string,
        string,
        string
      ];
      options[optionIndex] = value;
      return { ...question, options };
    });

  const setCorrectAnswer = (questionIndex: number, optionIndex: number) =>
    updateQuestion(questionIndex, (question) => ({
      ...question,
      correctAnswer: optionIndex,
    }));

  const setQuestionImage = (
    questionIndex: number,
    image: QuestionImage | null
  ) =>
    updateQuestion(questionIndex, (question) => ({ ...question, image }));

  const importQuiz = (quiz: SanitizedQuiz) =>
    setDraft((prev) => ({
      ...prev,
      questions: quiz.questions.map((q) => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        image: q.image,
      })),
      ...(quiz.name ? { name: quiz.name } : {}),
      ...(quiz.questionTimeLimit
        ? { questionTimeLimit: quiz.questionTimeLimit }
        : {}),
    }));

  return {
    draft,
    isValid: isValidDraft(draft),
    setName,
    setQuestionTimeLimit,
    addQuestion,
    removeQuestion,
    setQuestionText,
    setOption,
    setCorrectAnswer,
    setQuestionImage,
    importQuiz,
  };
}
