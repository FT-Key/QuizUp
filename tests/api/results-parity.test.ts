import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Game } from "@/core/domain/game";
import type { GameResults } from "@/core/domain/results/results-calculator";
import { calculateResults } from "@/core/domain/results/results-calculator";
import {
  toDomain,
  toResultsDto,
  type GameDoc,
} from "@/adapters/persistence/mongo/game.mapper";
import { ResultsBuilder, questionFixture } from "@/tests/builders/results-builder";
import {
  createFakeContainer,
  type FakeContainerOptions,
} from "@/tests/fakes/container";

// US-10/US-12: paridad route-vivo vs dominio-vivo.
//
// Espejo 1:1 de `tests/api/legacy-results-contract.test.ts` (9 casos), que
// congela la respuesta exacta de la ruta. Acá se ejecuta la ruta real sobre el
// repo fake (`getContainer`) y se compara contra `calculateResults` + el único
// cambio de presentación: `toResultsDto` (`Math.round` sobre `percentage`). Si
// cualquiera de los dos lados cambia de números o shape, el test falla sin
// copiar JSONs esperados.
//
// Migración US-12 (U9): el seed pasa por `toDomain` (incluye Map→Record) y ya no
// se mockea la ruta legacy.

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

import { GET as getResults } from "../../app/api/games/[gameId]/results/route";

interface CapturedResponse {
  body: { results: GameResults };
  status: number;
}

const GAME_PARAMS = { params: { gameId: "123456" } };
const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

function setupFake(options?: FakeContainerOptions): void {
  getContainerMock.mockReturnValue(createFakeContainer(options).container);
}

async function callResults(gameDoc: GameDoc): Promise<CapturedResponse> {
  setupFake({ seed: [toDomain(gameDoc)] });
  return (await getResults(
    {} as Request,
    GAME_PARAMS
  )) as unknown as CapturedResponse;
}

/** Doc Mongo equivalente al Game de dominio (mismo patrón que el mapper de la ruta). */
function toMongoDoc(
  game: Game,
  options?: { answersAsMap?: boolean }
): GameDoc {
  return {
    gameCode: game.id,
    name: game.name,
    status: "finished",
    createdAt: game.createdAt,
    creatorId: game.creatorId,
    currentQuestionIndex: game.currentQuestionIndex,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      answers: options?.answersAsMap
        ? new Map(Object.entries(p.answers))
        : { ...p.answers },
      score: p.score,
      joinedAt: p.joinedAt,
      avatar: p.avatar ?? null,
    })),
    questions: game.questions.map((q) => ({
      _id: { toString: () => q.id },
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      image: q.image ?? null,
    })),
  };
}

describe("paridad route GET /api/games/[gameId]/results ⇄ calculateResults (US-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("todos aciertan: score persistido (1500/900), percentage 100 y avatar de Ana", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(
        questionFixture("q1", 2, "¿Cuál es la capital de Francia?"),
        questionFixture("q2", 4, "¿Cuánto es 2 + 2?")
      )
      .withPlayers(
        {
          id: "p1",
          name: "Ana",
          answers: { q1: 2, q2: 4 },
          score: 1500,
          avatar: { seed: "ana" },
        },
        { id: "p2", name: "Beto", answers: { q1: 2, q2: 4 }, score: 900 }
      )
      .build();

    const response = await callResults(toMongoDoc(game));

    expect(response.status).toBe(200);
    expect(toResultsDto(calculateResults(game))).toEqual(
      response.body.results
    );
  });

  it("nadie acierta: score 0, correctAnswers 0, percentage 0 e isCorrect false", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 1))
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 9, q2: 9 }, score: 0 },
        { id: "p2", name: "Beto", answers: { q1: 9, q2: 9 }, score: 0 }
      )
      .build();

    const response = await callResults(toMongoDoc(game));

    expect(response.body.results).toEqual(toResultsDto(calculateResults(game)));
  });

  it("respuestas parciales: lo no respondido vale answer -1 e isCorrect false", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 3))
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 0 }, score: 750 },
        { id: "p2", name: "Beto", answers: {}, score: 0 }
      )
      .build();

    const response = await callResults(toMongoDoc(game));

    expect(response.body.results).toEqual(toResultsDto(calculateResults(game)));
  });

  it("percentage se redondea al entero (33/67) y averageScore NO se redondea (100.5)", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(
        questionFixture("q1", 0),
        questionFixture("q2", 1),
        questionFixture("q3", 2)
      )
      .withPlayers(
        { id: "p1", name: "Ana", answers: { q1: 0, q2: 9, q3: 9 }, score: 100 },
        { id: "p2", name: "Beto", answers: { q1: 0, q2: 1 }, score: 101 }
      )
      .build();

    const response = await callResults(toMongoDoc(game));
    const raw = calculateResults(game);

    // El dominio entrega el porcentaje crudo; el DTO lo redondea al presentar.
    expect(raw.leaderboard[0].percentage).not.toBe(33);
    expect(raw.leaderboard[0].percentage).toBeCloseTo(33.33333333333333);
    expect(response.body.results.leaderboard[0].percentage).toBe(33);
    expect(response.body.results.leaderboard[1].percentage).toBe(67);
    expect(response.body.results.averageScore).toBe(100.5);
    expect(toResultsDto(raw)).toEqual(response.body.results);
  });

  it("sin jugadores: leaderboard [], averageScore 0 por `|| 1` y playerAnswers vacío", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 0), questionFixture("q2", 1))
      .build();

    const response = await callResults(toMongoDoc(game));

    expect(response.body.results.leaderboard).toEqual([]);
    expect(response.body.results.averageScore).toBe(0);
    expect(toResultsDto(calculateResults(game))).toEqual(
      response.body.results
    );
  });

  it("sin preguntas: totalQuestions 0, questionResults [] y averageScore 200", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withPlayers(
        { id: "p1", name: "Ana", answers: {}, score: 300 },
        { id: "p2", name: "Beto", answers: {}, score: 100 }
      )
      .build();

    const response = await callResults(toMongoDoc(game));

    expect(response.body.results.totalQuestions).toBe(0);
    expect(response.body.results.questionResults).toEqual([]);
    expect(response.body.results.averageScore).toBe(200);
    expect(toResultsDto(calculateResults(game))).toEqual(
      response.body.results
    );
  });

  it("answers como Map de Mongoose produce el mismo body que un answers objeto plano", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 2), questionFixture("q2", 1))
      .withPlayer({
        id: "p1",
        name: "Ana",
        answers: { q1: 2, q2: 1 },
        score: 500,
        avatar: { seed: "ana" },
      })
      .build();

    const mapResponse = await callResults(
      toMongoDoc(game, { answersAsMap: true })
    );
    const plainResponse = await callResults(toMongoDoc(game));

    expect(mapResponse.body).toEqual(plainResponse.body);
    expect(mapResponse.body.results).toEqual(toResultsDto(calculateResults(game)));
  });

  it("avatar: se preserva si existe y la clave queda en undefined (no se omite) si falta", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 0))
      .withPlayers(
        {
          id: "p1",
          name: "Ana",
          answers: { q1: 0 },
          score: 100,
          avatar: { seed: "ana", accessories: ["glasses"] },
        },
        { id: "p2", name: "Beto", answers: { q1: 0 }, score: 50 }
      )
      .build();

    const response = await callResults(toMongoDoc(game));
    const domainResults = calculateResults(game);

    const betoRoute = response.body.results.leaderboard[1];
    const betoDomain = domainResults.leaderboard[1];
    expect(Object.keys(betoRoute)).toContain("avatar");
    expect(betoRoute.avatar).toBeUndefined();
    expect(Object.keys(betoDomain)).toContain("avatar");
    expect(betoDomain.avatar).toBeUndefined();
    expect(toResultsDto(domainResults)).toEqual(response.body.results);
  });

  it("el leaderboard conserva el orden del documento: no ordena por score", async () => {
    const game = new ResultsBuilder()
      .withId("123456")
      .withCreatedAt(CREATED_AT)
      .withQuestions(questionFixture("q1", 0))
      .withPlayers(
        { id: "p-zoe", name: "Zoe", answers: { q1: 0 }, score: 100 },
        { id: "p-ana", name: "Ana", answers: { q1: 0 }, score: 900 }
      )
      .build();

    const response = await callResults(toMongoDoc(game));

    expect(response.body.results.leaderboard.map((p) => p.playerId)).toEqual([
      "p-zoe",
      "p-ana",
    ]);
    expect(toResultsDto(calculateResults(game))).toEqual(response.body.results);
  });
});
