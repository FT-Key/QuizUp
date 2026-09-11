import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameResults } from "@/types";

// US-10: caracterización del contrato de éxito de `GET /api/games/[gameId]/results`
// (pre-refactor). Congela el JSON exacto que hoy devuelve la ruta como referencia
// de paridad para `core/domain/results/results-calculator.ts`.
//
// Sin Mongo ni red: se mockean `next/server`, `@/lib/mongoose` y `@/models/Game`,
// siguiendo el patrón de `tests/api/legacy-error-contract.test.ts`.
// Los casos de error (404/500) ya están congelados en ese archivo; acá solo se
// caracteriza el cálculo de resultados sobre un documento `finished`.

const { jsonMock, connectToDBMock, findOneMock } = vi.hoisted(() => ({
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status ?? 200,
  })),
  connectToDBMock: vi.fn(async () => ({ connection: { readyState: 1 } })),
  findOneMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: jsonMock },
}));

vi.mock("@/lib/mongoose", () => ({
  default: connectToDBMock,
}));

vi.mock("@/models/Game", () => ({
  Game: { findOne: findOneMock },
}));

import { GET as getResults } from "../../app/api/games/[gameId]/results/route";

interface CapturedResponse {
  body: { results: GameResults };
  status: number;
}

const GAME_PARAMS = { params: { gameId: "123456" } };
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

async function callResults(
  gameDoc: Record<string, unknown>
): Promise<CapturedResponse> {
  findOneMock.mockResolvedValue(gameDoc);
  return (await getResults(
    {} as Request,
    GAME_PARAMS
  )) as unknown as CapturedResponse;
}

/** Documento de juego `finished` con los campos que la ruta no recibe por override. */
function finishedGame(overrides: Record<string, unknown>) {
  return {
    gameCode: "123456",
    status: "finished",
    createdAt: CREATED_AT,
    ...overrides,
  };
}

/** Pregunta tal como la entrega Mongoose: `_id` es un ObjectId con `toString()`. */
function mongoQuestion(id: string, text: string, correctAnswer: number) {
  return {
    _id: { toString: () => id },
    text,
    options: ["A", "B", "C", "D"],
    correctAnswer,
    image: null,
  };
}

describe("GET /api/games/[gameId]/results — cálculo de resultados (caracterización US-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("todos aciertan: leaderboard.score usa el score persistido (no el conteo) y percentage es 100", async () => {
    const q1 = mongoQuestion("q1", "¿Cuál es la capital de Francia?", 2);
    const q2 = mongoQuestion("q2", "¿Cuánto es 2 + 2?", 4);

    const response = await callResults(
      finishedGame({
        players: [
          {
            id: "p1",
            name: "Ana",
            answers: { q1: 2, q2: 4 },
            score: 1500,
            joinedAt: CREATED_AT,
            avatar: { seed: "ana" },
          },
          {
            id: "p2",
            name: "Beto",
            answers: { q1: 2, q2: 4 },
            score: 900,
            joinedAt: CREATED_AT,
          },
        ],
        questions: [q1, q2],
      })
    );

    expect(response.status).toBe(200);
    expect(connectToDBMock).toHaveBeenCalledTimes(1);
    expect(findOneMock).toHaveBeenCalledWith({ gameCode: "123456" });
    // `score` (1500/900) es el puntaje persistido con bonus de tiempo del WS,
    // NO la cantidad de aciertos (2): el leaderboard debe reproducirlo tal cual.
    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 2,
        totalQuestions: 2,
        leaderboard: [
          {
            playerId: "p1",
            name: "Ana",
            score: 1500,
            correctAnswers: 2,
            totalQuestions: 2,
            percentage: 100,
            avatar: { seed: "ana" },
          },
          {
            playerId: "p2",
            name: "Beto",
            score: 900,
            correctAnswers: 2,
            totalQuestions: 2,
            percentage: 100,
            avatar: undefined,
          },
        ],
        questionResults: [
          {
            questionId: "q1",
            questionText: q1.text,
            correctAnswer: 2,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 2, isCorrect: true },
              { playerId: "p2", name: "Beto", answer: 2, isCorrect: true },
            ],
          },
          {
            questionId: "q2",
            questionText: q2.text,
            correctAnswer: 4,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 4, isCorrect: true },
              { playerId: "p2", name: "Beto", answer: 4, isCorrect: true },
            ],
          },
        ],
        averageScore: 1200,
      },
    });
  });

  it("nadie acierta: correctAnswers 0, percentage 0 e isCorrect false; un score ausente cae a 0", async () => {
    const q1 = mongoQuestion("q1", "Pregunta 1", 0);
    const q2 = mongoQuestion("q2", "Pregunta 2", 1);

    const response = await callResults(
      finishedGame({
        players: [
          // `score` ausente: el mapper aplica `p.score || 0`.
          { id: "p1", name: "Ana", answers: { q1: 9, q2: 9 }, joinedAt: CREATED_AT },
          {
            id: "p2",
            name: "Beto",
            answers: { q1: 9, q2: 9 },
            score: 0,
            joinedAt: CREATED_AT,
          },
        ],
        questions: [q1, q2],
      })
    );

    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 2,
        totalQuestions: 2,
        leaderboard: [
          {
            playerId: "p1",
            name: "Ana",
            score: 0,
            correctAnswers: 0,
            totalQuestions: 2,
            percentage: 0,
            avatar: undefined,
          },
          {
            playerId: "p2",
            name: "Beto",
            score: 0,
            correctAnswers: 0,
            totalQuestions: 2,
            percentage: 0,
            avatar: undefined,
          },
        ],
        questionResults: [
          {
            questionId: "q1",
            questionText: q1.text,
            correctAnswer: 0,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 9, isCorrect: false },
              { playerId: "p2", name: "Beto", answer: 9, isCorrect: false },
            ],
          },
          {
            questionId: "q2",
            questionText: q2.text,
            correctAnswer: 1,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 9, isCorrect: false },
              { playerId: "p2", name: "Beto", answer: 9, isCorrect: false },
            ],
          },
        ],
        averageScore: 0,
      },
    });
  });

  it("respuestas parciales: lo no respondido vale answer -1 e isCorrect false", async () => {
    const q1 = mongoQuestion("q1", "Pregunta 1", 0);
    const q2 = mongoQuestion("q2", "Pregunta 2", 3);

    const response = await callResults(
      finishedGame({
        players: [
          // Ana respondió solo q1 (correcta); Beto no respondió ninguna.
          { id: "p1", name: "Ana", answers: { q1: 0 }, score: 750, joinedAt: CREATED_AT },
          { id: "p2", name: "Beto", answers: {}, score: 0, joinedAt: CREATED_AT },
        ],
        questions: [q1, q2],
      })
    );

    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 2,
        totalQuestions: 2,
        leaderboard: [
          {
            playerId: "p1",
            name: "Ana",
            score: 750,
            correctAnswers: 1,
            totalQuestions: 2,
            percentage: 50,
            avatar: undefined,
          },
          {
            playerId: "p2",
            name: "Beto",
            score: 0,
            correctAnswers: 0,
            totalQuestions: 2,
            percentage: 0,
            avatar: undefined,
          },
        ],
        questionResults: [
          {
            questionId: "q1",
            questionText: q1.text,
            correctAnswer: 0,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 0, isCorrect: true },
              { playerId: "p2", name: "Beto", answer: -1, isCorrect: false },
            ],
          },
          {
            questionId: "q2",
            questionText: q2.text,
            correctAnswer: 3,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: -1, isCorrect: false },
              { playerId: "p2", name: "Beto", answer: -1, isCorrect: false },
            ],
          },
        ],
        averageScore: 375,
      },
    });
  });

  it("percentage se redondea al entero (33 y 67) y averageScore NO se redondea (100.5)", async () => {
    const q1 = mongoQuestion("q1", "Pregunta 1", 0);
    const q2 = mongoQuestion("q2", "Pregunta 2", 1);
    const q3 = mongoQuestion("q3", "Pregunta 3", 2);

    const response = await callResults(
      finishedGame({
        players: [
          // 1/3 aciertos -> 33.33%; score 100.
          {
            id: "p1",
            name: "Ana",
            answers: { q1: 0, q2: 9, q3: 9 },
            score: 100,
            joinedAt: CREATED_AT,
          },
          // 2/3 aciertos -> 66.67%; score 101.
          {
            id: "p2",
            name: "Beto",
            answers: { q1: 0, q2: 1 },
            score: 101,
            joinedAt: CREATED_AT,
          },
        ],
        questions: [q1, q2, q3],
      })
    );

    // La ruta redondea `percentage` con Math.round; US-10 define que el dominio
    // devuelve el porcentaje crudo y la capa REST/mapper redondea, como hoy.
    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 2,
        totalQuestions: 3,
        leaderboard: [
          {
            playerId: "p1",
            name: "Ana",
            score: 100,
            correctAnswers: 1,
            totalQuestions: 3,
            percentage: 33,
            avatar: undefined,
          },
          {
            playerId: "p2",
            name: "Beto",
            score: 101,
            correctAnswers: 2,
            totalQuestions: 3,
            percentage: 67,
            avatar: undefined,
          },
        ],
        questionResults: [
          {
            questionId: "q1",
            questionText: q1.text,
            correctAnswer: 0,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 0, isCorrect: true },
              { playerId: "p2", name: "Beto", answer: 0, isCorrect: true },
            ],
          },
          {
            questionId: "q2",
            questionText: q2.text,
            correctAnswer: 1,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 9, isCorrect: false },
              { playerId: "p2", name: "Beto", answer: 1, isCorrect: true },
            ],
          },
          {
            questionId: "q3",
            questionText: q3.text,
            correctAnswer: 2,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 9, isCorrect: false },
              { playerId: "p2", name: "Beto", answer: -1, isCorrect: false },
            ],
          },
        ],
        // (100 + 101) / 2: sin redondear, a diferencia de `percentage`.
        averageScore: 100.5,
      },
    });
  });

  it("sin jugadores: leaderboard vacío, averageScore 0 por `|| 1` y playerAnswers vacío", async () => {
    // Sin `_id`: el id de pregunta cae a `q.id` (fallback del mapper).
    const q1 = {
      id: "legacy-q1",
      text: "Pregunta 1",
      options: ["A", "B", "C", "D"],
      correctAnswer: 0,
    };
    const q2 = {
      id: "legacy-q2",
      text: "Pregunta 2",
      options: ["A", "B", "C", "D"],
      correctAnswer: 1,
    };

    const response = await callResults(
      finishedGame({
        players: [],
        questions: [q1, q2],
      })
    );

    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 0,
        totalQuestions: 2,
        leaderboard: [],
        questionResults: [
          {
            questionId: "legacy-q1",
            questionText: "Pregunta 1",
            correctAnswer: 0,
            playerAnswers: [],
          },
          {
            questionId: "legacy-q2",
            questionText: "Pregunta 2",
            correctAnswer: 1,
            playerAnswers: [],
          },
        ],
        // 0 / (0 || 1) === 0: nunca NaN.
        averageScore: 0,
      },
    });
  });

  it("sin preguntas: totalQuestions 0, percentage 0 sin dividir por cero y questionResults vacío", async () => {
    const response = await callResults(
      finishedGame({
        players: [
          { id: "p1", name: "Ana", answers: {}, score: 300, joinedAt: CREATED_AT },
          { id: "p2", name: "Beto", answers: {}, score: 100, joinedAt: CREATED_AT },
        ],
        questions: [],
      })
    );

    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 2,
        totalQuestions: 0,
        leaderboard: [
          {
            playerId: "p1",
            name: "Ana",
            score: 300,
            correctAnswers: 0,
            totalQuestions: 0,
            percentage: 0,
            avatar: undefined,
          },
          {
            playerId: "p2",
            name: "Beto",
            score: 100,
            correctAnswers: 0,
            totalQuestions: 0,
            percentage: 0,
            avatar: undefined,
          },
        ],
        questionResults: [],
        averageScore: 200,
      },
    });
  });

  it("answers como Map de Mongoose produce el mismo body que un answers objeto plano", async () => {
    const q1 = mongoQuestion("q1", "Pregunta 1", 2);
    const q2 = mongoQuestion("q2", "Pregunta 2", 1);

    const mapResponse = await callResults(
      finishedGame({
        players: [
          {
            id: "p1",
            name: "Ana",
            answers: new Map<string, number>([
              ["q1", 2],
              ["q2", 1],
            ]),
            score: 500,
            joinedAt: CREATED_AT,
            avatar: { seed: "ana" },
          },
        ],
        questions: [q1, q2],
      })
    );

    const plainResponse = await callResults(
      finishedGame({
        players: [
          {
            id: "p1",
            name: "Ana",
            answers: { q1: 2, q2: 1 },
            score: 500,
            joinedAt: CREATED_AT,
            avatar: { seed: "ana" },
          },
        ],
        questions: [q1, q2],
      })
    );

    expect(mapResponse.body).toEqual(plainResponse.body);
    expect(mapResponse.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 1,
        totalQuestions: 2,
        leaderboard: [
          {
            playerId: "p1",
            name: "Ana",
            score: 500,
            correctAnswers: 2,
            totalQuestions: 2,
            percentage: 100,
            avatar: { seed: "ana" },
          },
        ],
        questionResults: [
          {
            questionId: "q1",
            questionText: q1.text,
            correctAnswer: 2,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 2, isCorrect: true },
            ],
          },
          {
            questionId: "q2",
            questionText: q2.text,
            correctAnswer: 1,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 1, isCorrect: true },
            ],
          },
        ],
        averageScore: 500,
      },
    });
  });

  it("avatar: se preserva si existe y la clave queda en undefined (no se omite) si falta", async () => {
    const q1 = mongoQuestion("q1", "Pregunta 1", 0);

    const response = await callResults(
      finishedGame({
        players: [
          {
            id: "p1",
            name: "Ana",
            answers: { q1: 0 },
            score: 100,
            joinedAt: CREATED_AT,
            avatar: { seed: "ana", accessories: ["glasses"] },
          },
          {
            id: "p2",
            name: "Beto",
            answers: { q1: 0 },
            score: 50,
            joinedAt: CREATED_AT,
            avatar: null,
          },
        ],
        questions: [q1],
      })
    );

    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 2,
        totalQuestions: 1,
        leaderboard: [
          {
            playerId: "p1",
            name: "Ana",
            score: 100,
            correctAnswers: 1,
            totalQuestions: 1,
            percentage: 100,
            avatar: { seed: "ana", accessories: ["glasses"] },
          },
          {
            playerId: "p2",
            name: "Beto",
            score: 50,
            correctAnswers: 1,
            totalQuestions: 1,
            percentage: 100,
            avatar: undefined,
          },
        ],
        questionResults: [
          {
            questionId: "q1",
            questionText: q1.text,
            correctAnswer: 0,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 0, isCorrect: true },
              { playerId: "p2", name: "Beto", answer: 0, isCorrect: true },
            ],
          },
        ],
        averageScore: 75,
      },
    });

    // Decisión de caracterización: `p.avatar || undefined` asigna SIEMPRE la
    // clave en el objeto JS que recibe NextResponse (el JSON la omitiría al
    // serializar). `toEqual` ignora claves con `undefined`, por eso además
    // comprobamos la presencia de la clave explícitamente.
    const betoEntry = response.body.results.leaderboard[1];
    expect(Object.keys(betoEntry)).toContain("avatar");
    expect(betoEntry.avatar).toBeUndefined();
  });

  it("el leaderboard conserva el orden del documento: no ordena por score", async () => {
    const q1 = mongoQuestion("q1", "Pregunta 1", 0);

    const response = await callResults(
      finishedGame({
        players: [
          // Zoe va primero en el documento aunque tenga menos score.
          { id: "p-zoe", name: "Zoe", answers: { q1: 0 }, score: 100, joinedAt: CREATED_AT },
          { id: "p-ana", name: "Ana", answers: { q1: 0 }, score: 900, joinedAt: CREATED_AT },
        ],
        questions: [q1],
      })
    );

    expect(response.body).toEqual({
      results: {
        gameId: "123456",
        createdAt: CREATED_AT,
        totalPlayers: 2,
        totalQuestions: 1,
        leaderboard: [
          {
            playerId: "p-zoe",
            name: "Zoe",
            score: 100,
            correctAnswers: 1,
            totalQuestions: 1,
            percentage: 100,
            avatar: undefined,
          },
          {
            playerId: "p-ana",
            name: "Ana",
            score: 900,
            correctAnswers: 1,
            totalQuestions: 1,
            percentage: 100,
            avatar: undefined,
          },
        ],
        questionResults: [
          {
            questionId: "q1",
            questionText: q1.text,
            correctAnswer: 0,
            playerAnswers: [
              { playerId: "p-zoe", name: "Zoe", answer: 0, isCorrect: true },
              { playerId: "p-ana", name: "Ana", answer: 0, isCorrect: true },
            ],
          },
        ],
        averageScore: 500,
      },
    });
  });
});
