import { z } from "zod";
import { ValidationError } from "@/core/domain/errors";
import { TIME_LIMIT_OPTIONS } from "@/constants/game";
import { QuizFileError, sanitizeQuizData, type SanitizedQuiz } from "@/core/domain/quiz-file";
import { parseBody } from "./parse-body";

const [LIMIT_20S, LIMIT_30S, LIMIT_40S] = TIME_LIMIT_OPTIONS;

export const questionImageSchema = z.object({
  url: z.string(),
  thumb: z.string().optional(),
  alt: z.string().optional(),
  author: z.string().optional(),
  authorLink: z.string().optional(),
});

export const sanitizedQuestionSchema = z.object({
  text: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correctAnswer: z.number().int().min(0).max(3),
  image: questionImageSchema.nullable(),
});

export const createGameSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  questionTimeLimit: z
    .union([z.literal(LIMIT_20S), z.literal(LIMIT_30S), z.literal(LIMIT_40S)])
    .optional(),
  questions: z.array(sanitizedQuestionSchema).min(1).max(100),
});

export type CreateGameBody = z.infer<typeof createGameSchema>;

/**
 * Primero `sanitizeQuizData` (conserva los mensajes exactos de `QuizFileError`,
 * el orden y el truncado de `name` ya caracterizados), luego Zod sobre el
 * resultado saneado para tipar el input del caso de uso.
 * El fallback "Invalid game data" es el del catch legacy para errores no-QuizFileError.
 */
export function parseCreateGameBody(raw: unknown): CreateGameBody {
  let sanitized: SanitizedQuiz;
  try {
    sanitized = sanitizeQuizData(raw);
  } catch (cause) {
    throw new ValidationError(
      cause instanceof QuizFileError ? cause.message : "Invalid game data"
    );
  }
  return parseBody(createGameSchema, sanitized, "Invalid game data");
}
