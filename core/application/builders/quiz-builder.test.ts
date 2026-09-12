/**
 * Tests de `QuizBuilder` (US-14, §3.3.1 del design note).
 *
 * Cubre defaults, validación y payloads puros (POST / creación y export
 * `.quizup`) sin DOM: los tests G4/G5/G8-G10 caracterizan el uso desde GameForm.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { QuestionImage } from "../../domain/question";
import {
  buildCreateGamePayload,
  buildQuizExportFileName,
  buildQuizExportPayload,
  createEmptyQuestion,
  createEmptyQuizDraft,
  isValidDraft,
  type QuizDraft,
  type QuizDraftQuestion,
} from "./quiz-builder";

const validQuestion = (
  overrides: Partial<QuizDraftQuestion> = {}
): QuizDraftQuestion => ({
  text: "¿2+2?",
  options: ["1", "2", "3", "4"],
  correctAnswer: 2,
  image: null,
  ...overrides,
});

const makeDraft = (overrides: Partial<QuizDraft> = {}): QuizDraft => ({
  name: "Mi Quiz",
  questionTimeLimit: 30000,
  questions: [validQuestion()],
  ...overrides,
});

const unsplashImage: QuestionImage = {
  url: "https://images.unsplash.com/photo-1",
  alt: "Gato",
};

describe("QuizBuilder — defaults", () => {
  it("createEmptyQuestion devuelve la pregunta vacía caracterizada", () => {
    expect(createEmptyQuestion()).toEqual({
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      image: null,
    });
  });

  it("createEmptyQuizDraft devuelve 1 pregunta vacía y el límite por defecto", () => {
    const draft = createEmptyQuizDraft();

    expect(draft.name).toBe("");
    expect(draft.questionTimeLimit).toBe(DEFAULT_TIME_LIMIT_MS);
    expect(draft.questionTimeLimit).toBe(20000);
    expect(draft.questions).toEqual([createEmptyQuestion()]);
  });
});

describe("QuizBuilder — isValidDraft", () => {
  it("false con nombre vacío o solo espacios", () => {
    expect(isValidDraft(makeDraft({ name: "" }))).toBe(false);
    expect(isValidDraft(makeDraft({ name: "   " }))).toBe(false);
  });

  it("false con texto de pregunta vacío", () => {
    expect(
      isValidDraft(makeDraft({ questions: [validQuestion({ text: " " })] }))
    ).toBe(false);
  });

  it("false con una opción vacía o solo espacios", () => {
    expect(
      isValidDraft(
        makeDraft({
          questions: [validQuestion({ options: ["1", "", "3", "4"] })],
        })
      )
    ).toBe(false);
    expect(
      isValidDraft(
        makeDraft({
          questions: [validQuestion({ options: ["1", "2", "3", "   "] })],
        })
      )
    ).toBe(false);
  });

  it("true con nombre, texto y 4 opciones con contenido", () => {
    expect(isValidDraft(makeDraft())).toBe(true);
    expect(
      isValidDraft(
        makeDraft({
          name: " Otro ",
          questions: [
            validQuestion({ text: " P1 ", options: [" a ", " b ", " c ", " d "] }),
          ],
        })
      )
    ).toBe(true);
  });
});

describe("QuizBuilder — buildCreateGamePayload", () => {
  it("body exacto: name raw sin trim, límite y question con image null", () => {
    const payload = buildCreateGamePayload(
      makeDraft({ name: "  Mi Quiz  ", questionTimeLimit: 40000 })
    );

    expect(payload).toEqual({
      name: "  Mi Quiz  ",
      questionTimeLimit: 40000,
      questions: [
        {
          text: "¿2+2?",
          options: ["1", "2", "3", "4"],
          correctAnswer: 2,
          image: null,
        },
      ],
    });
  });

  it("propaga la imagen cuando existe y null cuando no", () => {
    const payload = buildCreateGamePayload(
      makeDraft({
        questions: [
          validQuestion({ image: unsplashImage }),
          validQuestion({ text: "Sin imagen", image: undefined }),
        ],
      })
    );

    expect(payload.questions[0].image).toEqual(unsplashImage);
    expect(payload.questions[1].image).toBeNull();
  });
});

describe("QuizBuilder — buildQuizExportPayload", () => {
  it("usa exportedAt inyectado, name raw y fallback 'Quiz sin nombre'", () => {
    const payload = buildQuizExportPayload(
      makeDraft({ name: "Mi Quiz 1!" }),
      "2026-01-02T03:04:05.678Z"
    );

    expect(payload).toEqual({
      format: "quizup",
      version: 1,
      exportedAt: "2026-01-02T03:04:05.678Z",
      name: "Mi Quiz 1!",
      questionTimeLimit: 30000,
      questions: [
        {
          text: "¿2+2?",
          options: ["1", "2", "3", "4"],
          correctAnswer: 2,
        },
      ],
    });

    expect(buildQuizExportPayload(makeDraft({ name: "" }), "t").name).toBe(
      "Quiz sin nombre"
    );
  });

  it("incluye image solo cuando tiene url", () => {
    const withImage = buildQuizExportPayload(
      makeDraft({ questions: [validQuestion({ image: unsplashImage })] }),
      "t"
    );
    const withoutImage = buildQuizExportPayload(
      makeDraft({ questions: [validQuestion({ image: null })] }),
      "t"
    );

    expect(withImage.questions[0].image).toEqual(unsplashImage);
    expect(withoutImage.questions[0]).not.toHaveProperty("image");
  });
});

describe("QuizBuilder — buildQuizExportFileName", () => {
  it("sanea el quirk caracterizado 'Mi Quiz 1!' ⇒ 'Mi_Quiz_1_.quizup'", () => {
    expect(buildQuizExportFileName("Mi Quiz 1!")).toBe("Mi_Quiz_1_.quizup");
  });

  it("usa 'quiz' cuando el nombre está vacío", () => {
    expect(buildQuizExportFileName("")).toBe("quiz.quizup");
  });

  it("conserva guiones y guiones bajos, y sanea acentos", () => {
    expect(buildQuizExportFileName("quiz-up_2")).toBe("quiz-up_2.quizup");
    expect(buildQuizExportFileName("Año")).toBe("A_o.quizup");
  });
});
