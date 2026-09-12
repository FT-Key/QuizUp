import type { QuestionImage } from "../../domain/question";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";

export interface QuizDraftQuestion {
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
  image?: QuestionImage | null;
}

export interface QuizDraft {
  name: string;
  questionTimeLimit: number;
  questions: QuizDraftQuestion[];
}

export interface CreateGamePayload {
  name: string;
  questionTimeLimit: number;
  questions: Array<{
    text: string;
    options: [string, string, string, string];
    correctAnswer: number;
    image: QuestionImage | null;
  }>;
}

export interface QuizExportPayload {
  format: "quizup";
  version: 1;
  exportedAt: string;
  name: string;
  questionTimeLimit: number;
  questions: Array<{
    text: string;
    options: [string, string, string, string];
    correctAnswer: number;
    image?: QuestionImage;
  }>;
}

export function createEmptyQuestion(): QuizDraftQuestion {
  return {
    text: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    image: null,
  };
}

export function createEmptyQuizDraft(): QuizDraft {
  return {
    name: "",
    questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    questions: [createEmptyQuestion()],
  };
}

export function isValidDraft(draft: QuizDraft): boolean {
  return Boolean(
    draft.name.trim() &&
      draft.questions.every(
        (q) => q.text.trim() && q.options.every((option) => option.trim())
      )
  );
  // NOTA: sin `questions.length > 0`, igual que el `isFormValid` actual (estado inalcanzable por UI).
}

export function buildCreateGamePayload(draft: QuizDraft): CreateGamePayload {
  return {
    name: draft.name, // raw, SIN trim (caracterizado)
    questionTimeLimit: draft.questionTimeLimit,
    questions: draft.questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      image: q.image ?? null, // body exacto: `image` siempre presente
    })),
  };
}

export function buildQuizExportPayload(
  draft: QuizDraft,
  exportedAt: string
): QuizExportPayload {
  return {
    format: "quizup",
    version: 1,
    exportedAt,
    name: draft.name || "Quiz sin nombre",
    questionTimeLimit: draft.questionTimeLimit,
    questions: draft.questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      ...(q.image?.url ? { image: q.image } : {}), // solo con url
    })),
  };
}

export function buildQuizExportFileName(name: string): string {
  return `${(name || "quiz").replace(/[^a-z0-9-_]+/gi, "_")}.quizup`; // quirk "Mi_Quiz_1_.quizup"
}
