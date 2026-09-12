import { describe, expect, it } from "vitest";
import {
  createGameSchema,
  parseCreateGameBody,
  questionImageSchema,
  sanitizedQuestionSchema,
} from "@/adapters/http/schemas/create-game.schema";
import { ValidationError } from "@/core/domain/errors";

// US-12 (§6/§9): `parseCreateGameBody` corre PRIMERO `sanitizeQuizData` (mensajes
// legacy intactos) y DESPUÉS `createGameSchema` para tipar. Los errores de Zod
// (inalcanzables tras el saneo, salvo bug) caen al fallback "Invalid game data".

const VALID_QUESTION = {
  text: "¿Cuál es la capital de Francia?",
  options: ["París", "Londres", "Berlín", "Madrid"],
  correctAnswer: 0,
};

function validationError(run: () => unknown): ValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) return error;
    throw error;
  }
  throw new Error("Se esperaba un ValidationError");
}

function question(overrides: Record<string, unknown> = {}) {
  return { ...VALID_QUESTION, ...overrides };
}

describe("adapters/http/schemas/create-game.schema", () => {
  it("un raw válido devuelve el body tipado con image normalizada a null", () => {
    const body = parseCreateGameBody({
      name: "Quiz",
      questionTimeLimit: 30000,
      questions: [VALID_QUESTION],
    });

    expect(body).toEqual({
      name: "Quiz",
      questionTimeLimit: 30000,
      questions: [{ ...VALID_QUESTION, image: null }],
    });
    expect(body.questions[0].options).toHaveLength(4);
  });

  it("questions ausente mapea al mensaje legacy de archivo sin preguntas", () => {
    const error = validationError(() => parseCreateGameBody({ name: "Quiz" }));

    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "El archivo no contiene preguntas.",
    });
  });

  it("los mensajes legacy de sanitize se conservan tal cual (texto, 4 respuestas, correctAnswer, >100)", () => {
    expect(
      validationError(() =>
        parseCreateGameBody({
          name: "Quiz",
          questions: [{ options: ["A", "B", "C", "D"], correctAnswer: 0 }],
        })
      )
    ).toMatchObject({ message: "Pregunta 1 (texto): se esperaba un texto." });

    expect(
      validationError(() =>
        parseCreateGameBody({
          name: "Quiz",
          questions: [question({ options: ["A", "B", "C"] })],
        })
      )
    ).toMatchObject({ message: "Pregunta 1: debe tener exactamente 4 respuestas." });

    expect(
      validationError(() =>
        parseCreateGameBody({
          name: "Quiz",
          questions: [question({ correctAnswer: 4 })],
        })
      )
    ).toMatchObject({ message: "Pregunta 1: la respuesta correcta es inválida." });

    expect(
      validationError(() =>
        parseCreateGameBody({
          name: "Quiz",
          questions: Array.from({ length: 101 }, (_, index) =>
            question({ text: `Pregunta ${index + 1}` })
          ),
        })
      )
    ).toMatchObject({
      message: "El archivo supera el máximo de 100 preguntas.",
    });
  });

  it("un name de más de 80 caracteres se trunca y no lanza", () => {
    const body = parseCreateGameBody({
      name: "A".repeat(85),
      questions: [VALID_QUESTION],
    });

    expect(body.name).toBe("A".repeat(80));
    expect(body.name).toHaveLength(80);
  });

  it("un questionTimeLimit no permitido se omite del body (el default lo aplica el use case)", () => {
    const body = parseCreateGameBody({
      name: "Quiz",
      questionTimeLimit: 12345,
      questions: [VALID_QUESTION],
    });

    expect(body.questionTimeLimit).toBeUndefined();
  });

  it("un error crudo de sanitize cae al fallback Invalid game data", () => {
    // Un getter que revienta NO es QuizFileError: el catch legacy usa el fallback.
    const exploding = {
      get text(): string {
        throw new Error("boom");
      },
    };

    const error = validationError(() =>
      parseCreateGameBody({ name: "Quiz", questions: [exploding] })
    );

    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "Invalid game data",
    });
  });

  it("los schemas exportados fijan el contrato exacto (§9)", () => {
    expect(questionImageSchema.safeParse({ url: "https://img.test/a.png" }).success).toBe(true);
    expect(questionImageSchema.safeParse({ url: 1 }).success).toBe(false);

    const parsed = sanitizedQuestionSchema.safeParse({
      ...VALID_QUESTION,
      image: null,
    });
    expect(parsed.success).toBe(true);
    // `image` es requerida (nullable): es lo que produce `sanitizeQuizData`.
    expect(
      createGameSchema.safeParse({
        questions: [{ ...VALID_QUESTION, image: null }],
      }).success
    ).toBe(true);
    expect(createGameSchema.safeParse({ questions: [VALID_QUESTION] }).success).toBe(
      false
    );
  });
});
