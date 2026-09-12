import type { QuestionImage } from "../question";
import { QUIZ_FILE_LIMITS } from "./constants";
import { QuizFileError } from "./errors";
import type { SanitizedQuestion, SanitizedQuiz } from "./types";

const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

function cleanText(value: unknown, maxLength: number, label: string): string {
  if (typeof value !== "string") {
    throw new QuizFileError(`${label}: se esperaba un texto.`);
  }
  const cleaned = value.replace(UNSAFE_CHARS, "").trim();
  if (!cleaned) {
    throw new QuizFileError(`${label}: no puede estar vacío.`);
  }
  if (cleaned.length > maxLength) {
    throw new QuizFileError(
      `${label}: supera el máximo de ${maxLength} caracteres.`
    );
  }
  return cleaned;
}

function cleanOptionalText(
  value: unknown,
  maxLength: number
): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(UNSAFE_CHARS, "").trim();
  if (!cleaned) return undefined;
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function safeUnsplashUrl(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > QUIZ_FILE_LIMITS.maxUrlLength
  ) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    if (host !== "unsplash.com" && !host.endsWith(".unsplash.com")) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined; // URL inválida ⇒ sin imagen (sanitización best-effort)
  }
}

function sanitizeImage(value: unknown): QuestionImage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const url = safeUnsplashUrl(raw.url);
  if (!url) return null;

  const thumb = safeUnsplashUrl(raw.thumb);
  const alt = cleanOptionalText(raw.alt, QUIZ_FILE_LIMITS.maxAltLength);
  const author = cleanOptionalText(raw.author, QUIZ_FILE_LIMITS.maxAuthorLength);
  const authorLink = safeUnsplashUrl(raw.authorLink);

  return {
    url,
    ...(thumb ? { thumb } : {}),
    ...(alt ? { alt } : {}),
    ...(author ? { author } : {}),
    ...(authorLink ? { authorLink } : {}),
  };
}

function sanitizeQuestion(value: unknown, index: number): SanitizedQuestion {
  const label = `Pregunta ${index + 1}`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QuizFileError(`${label}: formato inválido.`);
  }
  const raw = value as Record<string, unknown>;

  const text = cleanText(
    raw.text,
    QUIZ_FILE_LIMITS.maxQuestionTextLength,
    `${label} (texto)`
  );

  if (!Array.isArray(raw.options) || raw.options.length !== 4) {
    throw new QuizFileError(`${label}: debe tener exactamente 4 respuestas.`);
  }
  const options = raw.options.map((option, optionIndex) =>
    cleanText(
      option,
      QUIZ_FILE_LIMITS.maxOptionLength,
      `${label} (respuesta ${optionIndex + 1})`
    )
  ) as [string, string, string, string];

  if (
    typeof raw.correctAnswer !== "number" ||
    !Number.isInteger(raw.correctAnswer) ||
    raw.correctAnswer < 0 ||
    raw.correctAnswer > 3
  ) {
    throw new QuizFileError(`${label}: la respuesta correcta es inválida.`);
  }

  return {
    text,
    options,
    correctAnswer: raw.correctAnswer,
    image: sanitizeImage(raw.image),
  };
}

export function sanitizeQuizData(raw: unknown): SanitizedQuiz {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new QuizFileError("El contenido no tiene el formato esperado.");
  }
  const data = raw as Record<string, unknown>;

  const rawQuestions = Array.isArray(data.questions) ? data.questions : null;
  if (!rawQuestions || rawQuestions.length === 0) {
    throw new QuizFileError("El archivo no contiene preguntas.");
  }
  if (rawQuestions.length > QUIZ_FILE_LIMITS.maxQuestions) {
    throw new QuizFileError(
      `El archivo supera el máximo de ${QUIZ_FILE_LIMITS.maxQuestions} preguntas.`
    );
  }

  const name = cleanOptionalText(data.name, QUIZ_FILE_LIMITS.maxNameLength);
  const questions = rawQuestions.map((question, index) =>
    sanitizeQuestion(question, index)
  );

  const timeLimit = data.questionTimeLimit;
  const questionTimeLimit =
    typeof timeLimit === "number" &&
    (QUIZ_FILE_LIMITS.allowedTimeLimits as readonly number[]).includes(timeLimit)
      ? timeLimit
      : undefined;

  return {
    ...(name ? { name } : {}),
    ...(questionTimeLimit ? { questionTimeLimit } : {}),
    questions,
  };
}

export function parseQuizUpFile(text: string): SanitizedQuiz {
  if (typeof text !== "string" || text.length === 0) {
    throw new QuizFileError("El archivo está vacío.");
  }
  if (text.length > QUIZ_FILE_LIMITS.maxFileBytes) {
    throw new QuizFileError("El archivo es demasiado grande (máximo 2 MB).");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new QuizFileError("El archivo no es un JSON válido.");
  }

  let data: Record<string, unknown>;
  if (Array.isArray(parsed)) {
    data = { questions: parsed, name: "Quiz importado" };
  } else if (parsed && typeof parsed === "object") {
    data = parsed as Record<string, unknown>;
    if (data.format !== undefined && data.format !== "quizup") {
      throw new QuizFileError("El formato del archivo no es compatible.");
    }
  } else {
    throw new QuizFileError("El contenido no tiene el formato esperado.");
  }

  return sanitizeQuizData(data);
}
