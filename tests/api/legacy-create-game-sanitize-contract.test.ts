import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { GameRepository } from "@/core/application/ports/game-repository";
import type { Game } from "@/core/domain/game";
import {
  createFakeContainer,
  type FakeContainerOptions,
  type FakeContainerResult,
} from "@/tests/fakes/container";

// US-12: caracterización de la validación de creación (`sanitizeQuizData`) tal
// como la consume `POST /api/games` (post-refactor US-12). Congela los mensajes
// exactos de `QuizFileError`, los límites de `QUIZ_FILE_LIMITS`, el truncado de
// `name`, los time limits permitidos, el saneo de imágenes y la limpieza de
// caracteres de control.
//
// `legacy-error-contract.test.ts` ya congela el 400 de `questions: []`, el 400
// `Missing required fields` y el happy path con el default 20000; acá solo se
// cubren los huecos. Sin Mongo: el seam es `vi.mock("@/infra/container")` y las
// aserciones de persistencia se leen del repo fake (`repo.findById`).

const { jsonMock, getContainerMock } = vi.hoisted(() => ({
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
  })),
  getContainerMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: jsonMock },
}));

vi.mock("@/infra/container", () => ({
  getContainer: getContainerMock,
}));

import { POST as createGame } from "../../app/api/games/route";

interface CapturedResponse {
  /** Body pre-serialización capturado por el mock de `NextResponse.json`. */
  body: { game?: Game; error?: unknown };
  status: number;
}

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

async function capture(
  responsePromise: Promise<unknown>
): Promise<CapturedResponse> {
  return (await responsePromise) as unknown as CapturedResponse;
}

/** Partida persistida en el repo fake (la ruta siempre usa el código default). */
async function persistedGame(repo: GameRepository): Promise<Game> {
  const game = await repo.findById("123456");
  if (!game) throw new Error("La partida no fue persistida en el repo fake");
  return game;
}

/** Pregunta válida mínima; `overrides` permite romper un campo a la vez. */
function question(overrides: Record<string, unknown> = {}) {
  return {
    text: "¿Cuál es la capital de Francia?",
    options: ["París", "Londres", "Berlín", "Madrid"],
    correctAnswer: 0,
    ...overrides,
  };
}

describe("POST /api/games — validación de sanitizeQuizData (caracterización US-12)", () => {
  let fake: FakeContainerResult;

  function setupFake(options?: FakeContainerOptions): FakeContainerResult {
    fake = createFakeContainer(options);
    getContainerMock.mockReturnValue(fake.container);
    return fake;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupFake();
  });

  async function expectSanitizeError(body: unknown, message: string) {
    const response = await capture(createGame(fakeRequest(body)));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: message });
    // El legacy llamaba a `Game.create` solo tras el saneo; acá el repo queda vacío.
    await expect(fake.games.findById("123456")).resolves.toBeNull();
  }

  it("questions ausente responde 400 con el mensaje de archivo sin preguntas", async () => {
    await expectSanitizeError(
      { name: "Quiz" },
      "El archivo no contiene preguntas."
    );
  });

  it("questions no-array responde 400 con el mensaje de archivo sin preguntas", async () => {
    await expectSanitizeError(
      { name: "Quiz", questions: "no soy un array" },
      "El archivo no contiene preguntas."
    );
  });

  it("una pregunta sin text responde 400 'Pregunta 1 (texto): se esperaba un texto.'", async () => {
    await expectSanitizeError(
      {
        name: "Quiz",
        questions: [{ options: ["A", "B", "C", "D"], correctAnswer: 0 }],
      },
      "Pregunta 1 (texto): se esperaba un texto."
    );
  });

  it("CARACTERIZACIÓN: el text se valida antes que options y correctAnswer", async () => {
    // Aunque options y correctAnswer también son inválidos, gana el error de text.
    await expectSanitizeError(
      {
        name: "Quiz",
        questions: [{ options: ["solo una"], correctAnswer: 99 }],
      },
      "Pregunta 1 (texto): se esperaba un texto."
    );
  });

  it("options con 3 elementos responde 400 'Pregunta 1: debe tener exactamente 4 respuestas.'", async () => {
    await expectSanitizeError(
      { name: "Quiz", questions: [question({ options: ["A", "B", "C"] })] },
      "Pregunta 1: debe tener exactamente 4 respuestas."
    );
  });

  it("options que no es array responde 400 con el mismo mensaje de exactamente 4 respuestas", async () => {
    await expectSanitizeError(
      { name: "Quiz", questions: [question({ options: "ABCD" })] },
      "Pregunta 1: debe tener exactamente 4 respuestas."
    );
  });

  it("correctAnswer fuera de rango o no entero responde 400 'Pregunta 1: la respuesta correcta es inválida.'", async () => {
    await expectSanitizeError(
      { name: "Quiz", questions: [question({ correctAnswer: 4 })] },
      "Pregunta 1: la respuesta correcta es inválida."
    );
    await expectSanitizeError(
      { name: "Quiz", questions: [question({ correctAnswer: 1.5 })] },
      "Pregunta 1: la respuesta correcta es inválida."
    );
  });

  it("más de 100 preguntas responde 400 'El archivo supera el máximo de 100 preguntas.'", async () => {
    const questions = Array.from({ length: 101 }, (_, index) =>
      question({ text: `Pregunta ${index + 1}` })
    );

    await expectSanitizeError(
      { name: "Quiz", questions },
      "El archivo supera el máximo de 100 preguntas."
    );
  });

  it("un name de más de 80 caracteres se trunca a 80 y se persiste truncado (no rechaza)", async () => {
    const response = await capture(
      createGame(fakeRequest({ name: "A".repeat(85), questions: [question()] }))
    );

    expect(response.status).toBe(201);
    const stored = await persistedGame(fake.games);
    expect(stored.name).toBe("A".repeat(80));
    expect(stored.name).toHaveLength(80);
  });

  it("questionTimeLimit 30000 (permitido) se persiste tal cual", async () => {
    const response = await capture(
      createGame(
        fakeRequest({
          name: "Quiz",
          questionTimeLimit: 30000,
          questions: [question()],
        })
      )
    );

    expect(response.status).toBe(201);
    expect((await persistedGame(fake.games)).questionTimeLimit).toBe(30000);
  });

  it("questionTimeLimit 12345 (no permitido) cae al default 20000", async () => {
    const response = await capture(
      createGame(
        fakeRequest({
          name: "Quiz",
          questionTimeLimit: 12345,
          questions: [question()],
        })
      )
    );

    expect(response.status).toBe(201);
    expect((await persistedGame(fake.games)).questionTimeLimit).toBe(20000);
  });

  it("un image.url http (no https) se persiste como image: null", async () => {
    const response = await capture(
      createGame(
        fakeRequest({
          name: "Quiz",
          questions: [
            question({ image: { url: "http://images.unsplash.com/photo-1" } }),
          ],
        })
      )
    );

    expect(response.status).toBe(201);
    expect((await persistedGame(fake.games)).questions[0].image).toBeNull();
  });

  it("un image.url https de un host ajeno a unsplash se persiste como image: null", async () => {
    const response = await capture(
      createGame(
        fakeRequest({
          name: "Quiz",
          questions: [question({ image: { url: "https://evil.example/photo-1" } })],
        })
      )
    );

    expect(response.status).toBe(201);
    expect((await persistedGame(fake.games)).questions[0].image).toBeNull();
  });

  it("un image.url https de unsplash se persiste con la url normalizada", async () => {
    const response = await capture(
      createGame(
        fakeRequest({
          name: "Quiz",
          questions: [
            // Esquema y host en mayúsculas: `new URL(...).toString()` los normaliza.
            question({ image: { url: "HTTPS://Images.Unsplash.com/photo-1" } }),
          ],
        })
      )
    );

    expect(response.status).toBe(201);
    expect((await persistedGame(fake.games)).questions[0].image).toEqual({
      url: "https://images.unsplash.com/photo-1",
    });
  });

  it("el texto limpia caracteres de control y recorta espacios", async () => {
    const response = await capture(
      createGame(
        fakeRequest({
          name: "Quiz",
          questions: [question({ text: "  Hola\u0001  " })],
        })
      )
    );

    expect(response.status).toBe(201);
    expect((await persistedGame(fake.games)).questions[0].text).toBe("Hola");
  });

  it("un texto que queda vacío tras limpiar responde 400 'Pregunta 1 (texto): no puede estar vacío.'", async () => {
    await expectSanitizeError(
      { name: "Quiz", questions: [question({ text: "\u0001 \u0002" })] },
      "Pregunta 1 (texto): no puede estar vacío."
    );
  });
});
