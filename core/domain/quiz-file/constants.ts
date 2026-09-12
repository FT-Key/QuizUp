import { TIME_LIMIT_OPTIONS } from "@/constants/game";

/** Límites del formato `.quizup` (valores congelados por `parser.test.ts`). */
export const QUIZ_FILE_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024, // 2 MB
  maxQuestions: 100,
  maxNameLength: 80,
  maxQuestionTextLength: 300,
  maxOptionLength: 120,
  maxAltLength: 200,
  maxAuthorLength: 80,
  maxUrlLength: 2048,
  /** Una sola fuente para los límites válidos (BL-20): `constants/game`. */
  allowedTimeLimits: TIME_LIMIT_OPTIONS,
};
