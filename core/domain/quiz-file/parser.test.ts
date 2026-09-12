import { describe, expect, it } from "vitest";
import {
  parseQuizUpFile,
  QUIZ_FILE_LIMITS,
  QuizFileError,
  sanitizeQuizData,
} from "@/core/domain/quiz-file";

type RawRecord = Record<string, unknown>;

function validQuestion(overrides: RawRecord = {}): RawRecord {
  return {
    text: "¿Cuál es la capital de Francia?",
    options: ["París", "Londres", "Berlín", "Madrid"],
    correctAnswer: 0,
    ...overrides,
  };
}

function repeatQuestions(times: number): RawRecord[] {
  return Array.from({ length: times }, () => validQuestion());
}

const expectedQuestion = {
  text: "¿Cuál es la capital de Francia?",
  options: ["París", "Londres", "Berlín", "Madrid"],
  correctAnswer: 0,
  image: null,
};

function captureError(fn: () => unknown): QuizFileError {
  try {
    fn();
  } catch (error) {
    if (error instanceof QuizFileError) return error;
    throw error;
  }
  throw new Error("Se esperaba un QuizFileError, pero no se lanzó ningún error.");
}

function expectError(fn: () => unknown, message: string): void {
  const error = captureError(fn);
  expect(error.name).toBe("QuizFileError");
  expect(error.message).toBe(message);
}

describe("QUIZ_FILE_LIMITS", () => {
  it("expone los límites exactos del formato .quizup", () => {
    expect(QUIZ_FILE_LIMITS).toEqual({
      maxFileBytes: 2 * 1024 * 1024,
      maxQuestions: 100,
      maxNameLength: 80,
      maxQuestionTextLength: 300,
      maxOptionLength: 120,
      maxAltLength: 200,
      maxAuthorLength: 80,
      maxUrlLength: 2048,
      allowedTimeLimits: [20000, 30000, 40000],
    });
  });
});

describe("QuizFileError", () => {
  it("es un Error con name propio conservando el mensaje", () => {
    const error = new QuizFileError("mensaje de prueba");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(QuizFileError);
    expect(error.name).toBe("QuizFileError");
    expect(error.message).toBe("mensaje de prueba");
  });
});

describe("sanitizeQuizData", () => {
  it("un quiz válido devuelve nombre, límite de tiempo y preguntas saneadas", () => {
    const result = sanitizeQuizData({
      name: "Geografía",
      questionTimeLimit: 30000,
      questions: [validQuestion()],
    });

    expect(result).toStrictEqual({
      name: "Geografía",
      questionTimeLimit: 30000,
      questions: [expectedQuestion],
    });
  });

  it("omite name y questionTimeLimit cuando no están en la entrada", () => {
    const result = sanitizeQuizData({ questions: [validQuestion()] });

    expect(result).toStrictEqual({ questions: [expectedQuestion] });
    expect("name" in result).toBe(false);
    expect("questionTimeLimit" in result).toBe(false);
  });

  it("acepta los tres límites de tiempo permitidos y descarta cualquier otro", () => {
    for (const limit of [20000, 30000, 40000]) {
      const result = sanitizeQuizData({
        questions: [validQuestion()],
        questionTimeLimit: limit,
      });
      expect(result.questionTimeLimit).toBe(limit);
    }

    for (const invalid of [25000, 0, -30000, 20001, 35000]) {
      const result = sanitizeQuizData({
        questions: [validQuestion()],
        questionTimeLimit: invalid,
      });
      expect("questionTimeLimit" in result).toBe(false);
    }

    for (const invalid of ["30000", null, true]) {
      const result = sanitizeQuizData({
        questions: [validQuestion()],
        questionTimeLimit: invalid,
      });
      expect("questionTimeLimit" in result).toBe(false);
    }
  });

  it("recorta el name a 80 caracteres en lugar de lanzar error", () => {
    // CARACTERIZACIÓN: rareza conocida — name se trunca en silencio, mientras
    // los textos obligatorios de pregunta/opción lanzan error al superar el máximo.
    const longName = "a".repeat(81);
    const result = sanitizeQuizData({
      name: longName,
      questions: [validQuestion()],
    });

    expect(result.name).toBe("a".repeat(80));
    expect(result.name?.length).toBe(QUIZ_FILE_LIMITS.maxNameLength);
  });

  it("limpia y descarta name vacío o que no sea texto", () => {
    for (const invalid of ["   ", "\u0000\u0007", 42, null, true, ["x"]]) {
      const result = sanitizeQuizData({
        name: invalid,
        questions: [validQuestion()],
      });
      expect("name" in result).toBe(false);
    }

    const result = sanitizeQuizData({
      name: "  Geografía  ",
      questions: [validQuestion()],
    });
    expect(result.name).toBe("Geografía");
  });

  it("limpia espacios y caracteres de control en textos y opciones", () => {
    const result = sanitizeQuizData({
      questions: [
        validQuestion({
          text: " \u0000Hola\u0007 mundo\u007F\u009F ",
          options: ["  A\u0001  ", "B\t", "\u0002C", " D "],
        }),
      ],
    });

    const question = result.questions[0];
    expect(question.text).toBe("Hola mundo");
    expect(question.options).toStrictEqual(["A", "B", "C", "D"]);
  });

  it("conserva tabulaciones y saltos de línea internos", () => {
    const result = sanitizeQuizData({
      questions: [validQuestion({ text: "Hola\tmundo\n" })],
    });

    expect(result.questions[0].text).toBe("Hola\tmundo");
  });

  it("no muta el objeto de entrada", () => {
    const raw = {
      name: "  Geografía  ",
      questionTimeLimit: 30000,
      questions: [
        validQuestion({
          image: {
            url: "https://images.unsplash.com/photo-123",
            alt: "Foto",
          },
        }),
      ],
    };
    const clone = JSON.parse(JSON.stringify(raw)) as RawRecord;

    sanitizeQuizData(raw);

    expect(raw).toStrictEqual(clone);
  });

  it("rechaza un contenido que no sea objeto", () => {
    const message = "El contenido no tiene el formato esperado.";
    for (const invalid of [null, undefined, "texto", 42, true, []]) {
      expectError(() => sanitizeQuizData(invalid), message);
    }
  });

  it("rechaza objetos sin arreglo de preguntas o con arreglo vacío", () => {
    const message = "El archivo no contiene preguntas.";
    for (const invalid of [
      {},
      { questions: [] },
      { questions: null },
      { questions: "no soy un arreglo" },
      { questions: {} },
    ]) {
      expectError(() => sanitizeQuizData(invalid), message);
    }
  });

  it("acepta exactamente 100 preguntas y rechaza 101", () => {
    const result = sanitizeQuizData({ questions: repeatQuestions(100) });
    expect(result.questions).toHaveLength(100);

    expectError(
      () => sanitizeQuizData({ questions: repeatQuestions(101) }),
      "El archivo supera el máximo de 100 preguntas."
    );
  });

  it("señala la primera pregunta inválida con su número", () => {
    expectError(
      () =>
        sanitizeQuizData({
          questions: [validQuestion(), validQuestion({ text: "" })],
        }),
      "Pregunta 2 (texto): no puede estar vacío."
    );
  });

  it("ignora el campo format (solo parseQuizUpFile lo valida)", () => {
    // CARACTERIZACIÓN: rareza conocida — sanitizeQuizData no mira `format`.
    const result = sanitizeQuizData({
      format: "kahoot",
      questions: [validQuestion()],
    });
    expect(result.questions).toHaveLength(1);
  });

  describe("validación de cada pregunta", () => {
    it("rechaza una pregunta que no sea objeto", () => {
      const message = "Pregunta 1: formato inválido.";
      for (const invalid of [null, undefined, 7, "texto", []]) {
        expectError(
          () => sanitizeQuizData({ questions: [invalid] }),
          message
        );
      }
    });

    it("exige exactamente 4 respuestas", () => {
      const message = "Pregunta 1: debe tener exactamente 4 respuestas.";
      for (const options of [
        undefined,
        "no soy un arreglo",
        ["a", "b", "c"],
        ["a", "b", "c", "d", "e"],
        [],
      ]) {
        expectError(
          () => sanitizeQuizData({ questions: [validQuestion({ options })] }),
          message
        );
      }
    });

    it("exige texto de pregunta presente y de máximo 300 caracteres", () => {
      expectError(
        () => sanitizeQuizData({ questions: [validQuestion({ text: undefined })] }),
        "Pregunta 1 (texto): se esperaba un texto."
      );
      expectError(
        () => sanitizeQuizData({ questions: [validQuestion({ text: 42 })] }),
        "Pregunta 1 (texto): se esperaba un texto."
      );
      expectError(
        () => sanitizeQuizData({ questions: [validQuestion({ text: "" })] }),
        "Pregunta 1 (texto): no puede estar vacío."
      );
      expectError(
        () => sanitizeQuizData({ questions: [validQuestion({ text: "   " })] }),
        "Pregunta 1 (texto): no puede estar vacío."
      );
      expectError(
        () =>
          sanitizeQuizData({
            questions: [validQuestion({ text: "a".repeat(301) })],
          }),
        "Pregunta 1 (texto): supera el máximo de 300 caracteres."
      );

      const exact = sanitizeQuizData({
        questions: [validQuestion({ text: "a".repeat(300) })],
      });
      expect(exact.questions[0].text).toHaveLength(300);
    });

    it("cuenta la longitud en unidades UTF-16 (los emojis suman 2)", () => {
      // CARACTERIZACIÓN: rareza conocida — los máximos se miden con .length
      // (unidades UTF-16), no con caracteres visibles ni bytes.
      const accepted = sanitizeQuizData({
        questions: [validQuestion({ text: "😀".repeat(150) })],
      });
      expect(accepted.questions[0].text).toBe("😀".repeat(150));

      expectError(
        () =>
          sanitizeQuizData({
            questions: [validQuestion({ text: "😀".repeat(151) })],
          }),
        "Pregunta 1 (texto): supera el máximo de 300 caracteres."
      );
    });

    it("exige cada respuesta como texto no vacío de máximo 120 caracteres", () => {
      expectError(
        () =>
          sanitizeQuizData({
            questions: [
              validQuestion({ options: ["a".repeat(121), "b", "c", "d"] }),
            ],
          }),
        "Pregunta 1 (respuesta 1): supera el máximo de 120 caracteres."
      );
      expectError(
        () =>
          sanitizeQuizData({
            questions: [validQuestion({ options: ["a", "", "c", "d"] })],
          }),
        "Pregunta 1 (respuesta 2): no puede estar vacío."
      );
      expectError(
        () =>
          sanitizeQuizData({
            questions: [validQuestion({ options: ["a", "b", 99, "d"] })],
          }),
        "Pregunta 1 (respuesta 3): se esperaba un texto."
      );

      const exact = sanitizeQuizData({
        questions: [
          validQuestion({ options: ["a".repeat(120), "b", "c", "d"] }),
        ],
      });
      expect(exact.questions[0].options[0]).toHaveLength(120);
    });

    it("valida correctAnswer como entero entre 0 y 3", () => {
      const accepted = sanitizeQuizData({
        questions: [validQuestion({ correctAnswer: 3 })],
      });
      expect(accepted.questions[0].correctAnswer).toBe(3);

      const message = "Pregunta 1: la respuesta correcta es inválida.";
      for (const invalid of [4, -1, 1.5, Number.NaN, "1", null, true]) {
        expectError(
          () =>
            sanitizeQuizData({
              questions: [validQuestion({ correctAnswer: invalid })],
            }),
          message
        );
      }
    });

    it("valida las respuestas antes que correctAnswer", () => {
      expectError(
        () =>
          sanitizeQuizData({
            questions: [
              validQuestion({
                options: ["a", "b", "c", "d", "e"],
                correctAnswer: 9,
              }),
            ],
          }),
        "Pregunta 1: debe tener exactamente 4 respuestas."
      );
    });
  });

  describe("validación de la imagen", () => {
    it("devuelve image null cuando la imagen falta o es inválida", () => {
      for (const image of [
        undefined,
        null,
        "texto",
        42,
        [],
        { url: 42 },
        { url: "no es una url" },
        { url: "http://images.unsplash.com/photo-123" },
        { url: "https://example.com/photo" },
        { url: "https://unsplash.com.evil.com/photo" },
        { url: "https://notunsplash.com/photo" },
      ]) {
        const result = sanitizeQuizData({
          questions: [validQuestion({ image })],
        });
        expect(result.questions[0].image).toBeNull();
      }
    });

    it("conserva y normaliza una imagen Unsplash válida", () => {
      const result = sanitizeQuizData({
        questions: [
          validQuestion({
            image: {
              url: "https://images.unsplash.com/photo-123?ixlib=rb-4.0.3",
              thumb: "https://images.unsplash.com/photo-123?w=200",
              alt: "Foto de París",
              author: "Ada Lovelace",
              authorLink: "https://unsplash.com/@ada",
            },
          }),
        ],
      });

      expect(result.questions[0].image).toStrictEqual({
        url: "https://images.unsplash.com/photo-123?ixlib=rb-4.0.3",
        thumb: "https://images.unsplash.com/photo-123?w=200",
        alt: "Foto de París",
        author: "Ada Lovelace",
        authorLink: "https://unsplash.com/@ada",
      });
    });

    it("normaliza a minúsculas el host de la URL", () => {
      const result = sanitizeQuizData({
        questions: [
          validQuestion({
            image: { url: "https://Images.Unsplash.com/Photo" },
          }),
        ],
      });

      expect(result.questions[0].image).toStrictEqual({
        url: "https://images.unsplash.com/Photo",
      });
    });

    it("recorta alt a 200 caracteres y author a 80", () => {
      const result = sanitizeQuizData({
        questions: [
          validQuestion({
            image: {
              url: "https://unsplash.com/",
              alt: "a".repeat(201),
              author: "b".repeat(81),
            },
          }),
        ],
      });

      expect(result.questions[0].image).toStrictEqual({
        url: "https://unsplash.com/",
        alt: "a".repeat(200),
        author: "b".repeat(80),
      });
    });

    it("omite thumb y authorLink inválidos pero conserva la imagen", () => {
      const result = sanitizeQuizData({
        questions: [
          validQuestion({
            image: {
              url: "https://images.unsplash.com/photo-123",
              thumb: "https://example.com/thumb",
              authorLink: "http://unsplash.com/@ada",
            },
          }),
        ],
      });

      expect(result.questions[0].image).toStrictEqual({
        url: "https://images.unsplash.com/photo-123",
      });
    });
  });
});

describe("parseQuizUpFile", () => {
  it("parsea un JSON plano con preguntas y límite de tiempo", () => {
    const file = JSON.stringify({
      name: "Geografía",
      questionTimeLimit: 40000,
      questions: [validQuestion()],
    });

    expect(parseQuizUpFile(file)).toStrictEqual({
      name: "Geografía",
      questionTimeLimit: 40000,
      questions: [expectedQuestion],
    });
  });

  it("acepta format 'quizup' y rechaza cualquier otro valor de format", () => {
    const compatible = JSON.stringify({
      format: "quizup",
      questions: [validQuestion()],
    });
    expect(parseQuizUpFile(compatible).questions).toHaveLength(1);

    const message = "El formato del archivo no es compatible.";
    for (const format of ["kahoot", null, 1, true, {}]) {
      expectError(
        () => parseQuizUpFile(JSON.stringify({ format, questions: [validQuestion()] })),
        message
      );
    }
  });

  it("trata un arreglo JSON como preguntas con name 'Quiz importado'", () => {
    const file = JSON.stringify([validQuestion()]);

    expect(parseQuizUpFile(file)).toStrictEqual({
      name: "Quiz importado",
      questions: [expectedQuestion],
    });
  });

  it("rechaza un arreglo JSON vacío como archivo sin preguntas", () => {
    expectError(
      () => parseQuizUpFile("[]"),
      "El archivo no contiene preguntas."
    );
  });

  it("rechaza JSON que no sea objeto ni arreglo", () => {
    const message = "El contenido no tiene el formato esperado.";
    for (const file of ["null", "42", '"hola"', "true"]) {
      expectError(() => parseQuizUpFile(file), message);
    }
  });

  it("rechaza un archivo vacío o que no sea texto", () => {
    const message = "El archivo está vacío.";
    expectError(() => parseQuizUpFile(""), message);
    expectError(
      () => parseQuizUpFile(null as unknown as string),
      message
    );
    expectError(
      () => parseQuizUpFile(undefined as unknown as string),
      message
    );
  });

  it("rechaza JSON malformado", () => {
    const message = "El archivo no es un JSON válido.";
    expectError(() => parseQuizUpFile("{"), message);
    expectError(() => parseQuizUpFile("   "), message);
    expectError(() => parseQuizUpFile("{ preguntas: }"), message);
  });

  it("rechaza contenido mayor a 2 MB sin intentar parsearlo", () => {
    // CARACTERIZACIÓN: bug conocido — maxFileBytes compara text.length
    // (unidades UTF-16), no bytes reales; contenido multibyte puede superar 2 MiB.
    const tooBig = "x".repeat(QUIZ_FILE_LIMITS.maxFileBytes + 1);
    expectError(
      () => parseQuizUpFile(tooBig),
      "El archivo es demasiado grande (máximo 2 MB)."
    );

    const exactlyMax = " ".repeat(QUIZ_FILE_LIMITS.maxFileBytes);
    expectError(() => parseQuizUpFile(exactlyMax), "El archivo no es un JSON válido.");
  });

  it("un JSON sin name ni questionTimeLimit no agrega esas claves", () => {
    const file = JSON.stringify({ questions: [validQuestion()] });

    expect(parseQuizUpFile(file)).toStrictEqual({
      questions: [expectedQuestion],
    });
  });

  it("propaga la validación de preguntas con el índice correcto tras parsear", () => {
    const file = JSON.stringify({
      questions: [validQuestion(), { text: "Ok", options: ["a", "b"], correctAnswer: 0 }],
    });

    expectError(
      () => parseQuizUpFile(file),
      "Pregunta 2: debe tener exactamente 4 respuestas."
    );
  });
});
