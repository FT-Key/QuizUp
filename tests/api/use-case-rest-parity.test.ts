import { describe, expect, it } from "vitest";
import {
  toDomain,
  toGameDto,
  toJoinGameDto,
  toPlayerDto,
  toResultsDto,
  toStartGameDto,
  type GameDoc,
  type GameDocQuestion,
} from "@/adapters/persistence/mongo/game.mapper";
import { createFinishGameUseCase } from "@/core/application/use-cases/finish-game";
import { createGetGameUseCase } from "@/core/application/use-cases/get-game";
import { createGetResultsUseCase } from "@/core/application/use-cases/get-results";
import { createJoinGameUseCase } from "@/core/application/use-cases/join-game";
import { createStartGameUseCase } from "@/core/application/use-cases/start-game";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";
import { fixedClock, sequentialIds } from "@/tests/fakes/system";

// US-11 §7 paso 10: paridad REST del pipeline NUEVO (fake repo + casos de uso +
// mapper) contra los JSON congelados por las caracterizaciones legacy. Cada
// bloque documenta su test legacy de referencia.
//
// Reglas de la paridad:
// - Docs realistas: las preguntas SIEMPRE traen `_id` (como Mongoose). El caso
//   sintético sin `_id` de `legacy-game-dto-contract` (D3) NO se replica acá;
//   lo cubre `adapters/persistence/mongo/game.mapper.test.ts`.
// - D1 (aprobada): create/list/join normalizan las preguntas a `{ id, ... }`
//   sin `_id`; el resto del JSON es idéntico al legacy.
// - D2 (aprobada): el mapper unificado omite `avatar` cuando es `null`
//   (coherente con GET) y normaliza `answers`/`score`/`gameId`; el legacy de
//   join hacía pass-through (podía emitir `avatar: null`).

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");
const START_NOW = new Date("2026-03-01T10:00:00.000Z").getTime();

/** Pregunta tal como la entrega Mongoose: `_id` es un ObjectId con `toString()`. */
function mongoQuestion(
  id: string,
  text: string,
  correctAnswer: number,
  image: GameDocQuestion["image"] = null
): GameDocQuestion {
  return {
    _id: { toString: () => id },
    text,
    options: ["A", "B", "C", "D"],
    correctAnswer,
    image,
  };
}

describe("paridad REST: pipeline US-11 (fake + use cases + mapper)", () => {
  // Referencia: `legacy-game-dto-contract.test.ts` → "mapea preguntas y
  // jugadores con los fallbacks exactos del mapper legacy".
  it("GET /api/games/[gameId] — doc completo (mismo JSON que el legacy)", async () => {
    const q1 = mongoQuestion("q1", "¿Cuál es la capital de Francia?", 2, {
      url: "https://img.test/francia.png",
      thumb: "https://img.test/francia-thumb.png",
    });
    const q2 = mongoQuestion("q2", "¿Cuánto es 2 + 2?", 1);
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [q1, q2],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 2,
      currentQuestionStartTime: 1_700_000_000_000,
      questionTimeLimit: 30000,
      locked: true,
      createdAt: CREATED_AT,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "game-id-viejo",
          answers: { q1: 2 },
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana", accessories: ["hat"] },
        },
        // Sin `answers`/`score`/`avatar`: el dominio aplica `{}`, `0` y `undefined`.
        { id: "p2", name: "Beto", gameId: "game-id-viejo", joinedAt: JOINED_AT },
      ],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createGetGameUseCase({ games: repo });

    const response = {
      game: toGameDto(await useCase.execute({ gameId: "123456" })),
    };

    expect(response).toEqual({
      game: {
        id: "123456",
        name: "Geografía",
        questions: [
          {
            id: "q1",
            text: q1.text,
            options: q1.options,
            correctAnswer: 2,
            image: { url: "https://img.test/francia.png", thumb: "https://img.test/francia-thumb.png" },
          },
          {
            // D3: acá la pregunta trae `_id` real, así que el id es "q2"
            // (el legacy sintético sin `_id` daba ""; no se replica).
            id: "q2",
            text: q2.text,
            options: q2.options,
            correctAnswer: 1,
            image: null,
          },
        ],
        creatorId: "creator-1",
        status: "waiting",
        currentQuestionIndex: 2,
        currentQuestionStartTime: 1_700_000_000_000,
        questionTimeLimit: 30000,
        locked: true,
        createdAt: CREATED_AT,
        players: [
          {
            id: "p1",
            name: "Ana",
            gameId: "123456",
            answers: { q1: 2 },
            score: 1500,
            joinedAt: JOINED_AT,
            avatar: { seed: "ana", accessories: ["hat"] },
          },
          {
            id: "p2",
            name: "Beto",
            gameId: "123456",
            answers: {},
            score: 0,
            joinedAt: JOINED_AT,
            avatar: undefined,
          },
        ],
      },
    });

    expect(Object.keys(response.game).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "currentQuestionStartTime",
      "id",
      "locked",
      "name",
      "players",
      "questionTimeLimit",
      "questions",
      "status",
    ]);
    expect(Object.keys(response.game.players[1]).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(response.game.players[1].avatar).toBeUndefined();
  });

  // Referencia: `legacy-game-dto-contract.test.ts` → "un doc sin campos
  // opcionales cae a 0 / 20000 / false y los arrays ausentes quedan vacíos".
  it("GET /api/games/[gameId] — doc mínimo (fallbacks 0 / 20000 / false)", async () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Vacío",
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createGetGameUseCase({ games: repo });

    const response = {
      game: toGameDto(await useCase.execute({ gameId: "123456" })),
    };

    expect(response).toEqual({
      game: {
        id: "123456",
        name: "Vacío",
        questions: [],
        creatorId: "creator-1",
        status: "waiting",
        currentQuestionIndex: 0,
        currentQuestionStartTime: 0,
        // 20000: valor actual de DEFAULT_TIME_LIMIT_MS (constants/game.ts).
        questionTimeLimit: 20000,
        locked: false,
        createdAt: CREATED_AT,
        players: [],
      },
    });
  });

  // Referencia: `legacy-game-dto-contract.test.ts` → "un avatar provisto por el
  // cliente se respeta..." + `legacy-error-contract.test.ts` → "un join válido
  // responde 200 y agrega al jugador con avatar por defecto".
  it("POST /api/games/join — avatar provisto (D1: preguntas normalizadas)", async () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [mongoQuestion("q1", "¿Cuál es la capital de Francia?", 0)],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
      players: [],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createJoinGameUseCase({
      games: repo,
      ids: sequentialIds("uuid"),
      clock: fixedClock(START_NOW),
    });
    const avatar = { seed: "custom", accessories: ["glasses"] };

    const { player, game } = await useCase.execute({
      gameId: "123456",
      playerName: "Alice",
      avatar,
    });
    const response = { player: toPlayerDto(player), game: toJoinGameDto(game) };

    expect(response).toEqual({
      player: {
        id: "uuid-1",
        name: "Alice",
        gameId: "123456",
        answers: {},
        score: 0,
        joinedAt: new Date(START_NOW),
        avatar: { seed: "custom", accessories: ["glasses"] },
      },
      game: {
        id: "123456",
        name: "Geografía",
        // D1: el legacy emitía `game.questions` crudo (con `_id`); el mapper
        // unificado normaliza a `{ id, text, options, correctAnswer, image }`.
        questions: [
          {
            id: "q1",
            text: "¿Cuál es la capital de Francia?",
            options: ["A", "B", "C", "D"],
            correctAnswer: 0,
            image: null,
          },
        ],
        creatorId: "creator-1",
        status: "waiting",
        currentQuestionIndex: 0,
        createdAt: CREATED_AT,
        players: [
          {
            id: "uuid-1",
            name: "Alice",
            gameId: "123456",
            answers: {},
            score: 0,
            joinedAt: new Date(START_NOW),
            avatar: { seed: "custom", accessories: ["glasses"] },
          },
        ],
      },
    });
    // Legacy: `response.body.player.avatar` conserva la referencia del input.
    expect(response.player.avatar).toBe(avatar);
    expect(Object.keys(response.player).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(Object.keys(response.game).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "id",
      "name",
      "players",
      "questions",
      "status",
    ]);
    expect(response.game).not.toHaveProperty("currentQuestionStartTime");
    expect(response.game).not.toHaveProperty("questionTimeLimit");
    expect(response.game).not.toHaveProperty("locked");
  });

  // Referencia: `legacy-game-dto-contract.test.ts` → "sin avatar usa el default
  // `{ seed: playerName }`..." y "un jugador preexistente del doc NO recibe los
  // fallbacks..." (esta última ajustada por D2, aprobada en el addendum §10).
  it("POST /api/games/join — sin avatar: default y normalización D2 del jugador previo", async () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [mongoQuestion("q1", "¿Cuál es la capital de Francia?", 0)],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
      players: [
        // Sin answers/score y con `avatar: null`: D2 unifica con GET
        // (`avatar` undefined) y normaliza `{}` / 0 / gameId del dominio.
        { id: "p0", name: "Zoe", gameId: "codigo-viejo", joinedAt: JOINED_AT, avatar: null },
      ],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createJoinGameUseCase({
      games: repo,
      ids: sequentialIds("uuid"),
      clock: fixedClock(START_NOW),
    });

    const { player, game } = await useCase.execute({
      gameId: "123456",
      playerName: "Alice",
    });
    const response = { player: toPlayerDto(player), game: toJoinGameDto(game) };

    expect(response.player.avatar).toEqual({ seed: "Alice" });
    expect(response.game.players).toHaveLength(2);

    const zoe = response.game.players[0];
    expect(zoe).toEqual({
      id: "p0",
      name: "Zoe",
      gameId: "123456",
      answers: {},
      score: 0,
      joinedAt: JOINED_AT,
      avatar: undefined,
    });
    // La clave `avatar` sigue presente (ahora undefined), no `null` como el legacy.
    expect(Object.keys(zoe).sort()).toEqual([
      "answers",
      "avatar",
      "gameId",
      "id",
      "joinedAt",
      "name",
      "score",
    ]);
    expect(zoe.avatar).toBeUndefined();

    expect(response.game.players[1]).toMatchObject({
      id: "uuid-1",
      name: "Alice",
      gameId: "123456",
      answers: {},
      score: 0,
      avatar: { seed: "Alice" },
    });
  });

  // Referencia: `legacy-game-lifecycle-contract.test.ts` → "inicia la partida:
  // persiste 20000 por defecto, fecha con Date.now() fakeado y devuelve el DTO
  // exacto sin locked".
  it("POST /api/games/[gameId]/start — sin questionTimeLimit persiste 20000", async () => {
    const q1 = mongoQuestion("q1", "¿Cuál es la capital de Francia?", 2);
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [q1],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 3, // La ruta lo reescribe a 0.
      createdAt: CREATED_AT,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "game-id-viejo",
          answers: { q1: 2 },
          score: 1500,
          joinedAt: JOINED_AT,
          avatar: { seed: "ana" },
        },
        { id: "p2", name: "Beto", gameId: "game-id-viejo", joinedAt: JOINED_AT },
      ],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createStartGameUseCase({
      games: repo,
      clock: fixedClock(START_NOW),
    });

    const game = await useCase.execute({ gameId: "123456" });

    // Efectos sobre la partida persistida (espejo de `gameDoc` en el legacy).
    await expect(repo.findById("123456")).resolves.toMatchObject({
      status: "active",
      currentQuestionIndex: 0,
      currentQuestionStartTime: START_NOW,
      questionTimeLimit: 20000,
    });

    const response = { game: toStartGameDto(game) };

    expect(response).toEqual({
      game: {
        id: "123456",
        name: "Geografía",
        questions: [
          { id: "q1", text: q1.text, options: q1.options, correctAnswer: 2, image: null },
        ],
        creatorId: "creator-1",
        status: "active",
        currentQuestionIndex: 0,
        currentQuestionStartTime: START_NOW,
        questionTimeLimit: 20000,
        createdAt: CREATED_AT,
        players: [
          {
            id: "p1",
            name: "Ana",
            gameId: "123456",
            answers: { q1: 2 },
            score: 1500,
            joinedAt: JOINED_AT,
            avatar: { seed: "ana" },
          },
          {
            id: "p2",
            name: "Beto",
            gameId: "123456",
            answers: {},
            score: 0,
            joinedAt: JOINED_AT,
            avatar: undefined,
          },
        ],
      },
    });
    expect(Object.keys(response.game).sort()).toEqual([
      "createdAt",
      "creatorId",
      "currentQuestionIndex",
      "currentQuestionStartTime",
      "id",
      "name",
      "players",
      "questionTimeLimit",
      "questions",
      "status",
    ]);
    expect(response.game).not.toHaveProperty("locked");
    expect(response.game.players[1].avatar).toBeUndefined();
  });

  // Referencia: `legacy-game-lifecycle-contract.test.ts` → "respeta el
  // questionTimeLimit ya definido en el doc (no lo pisa con el default)".
  it("POST /api/games/[gameId]/start — conserva un questionTimeLimit de 30000", async () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [],
      creatorId: "creator-1",
      status: "waiting",
      currentQuestionIndex: 0,
      questionTimeLimit: 30000,
      createdAt: CREATED_AT,
      players: [{ id: "p1", name: "Ana", joinedAt: JOINED_AT }],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createStartGameUseCase({
      games: repo,
      clock: fixedClock(START_NOW),
    });

    const game = await useCase.execute({ gameId: "123456" });

    await expect(repo.findById("123456")).resolves.toMatchObject({
      questionTimeLimit: 30000,
    });
    expect(game.questionTimeLimit).toBe(30000);
    expect(toStartGameDto(game).questionTimeLimit).toBe(30000);
  });

  // Referencia: `legacy-game-lifecycle-contract.test.ts` → "finaliza la
  // partida: status finished, índice en la última pregunta y body exacto
  // { success: true }" y "CARACTERIZACIÓN: sin preguntas el índice queda en -1".
  it("POST /api/games/[gameId]/finish — índice en la última pregunta y { success: true }", async () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [
        mongoQuestion("q1", "Pregunta 1", 0),
        mongoQuestion("q2", "Pregunta 2", 1),
        mongoQuestion("q3", "Pregunta 3", 2),
      ],
      creatorId: "creator-1",
      status: "active",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
      players: [],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createFinishGameUseCase({ games: repo });

    const result = await useCase.execute({ gameId: "123456" });

    expect(result).toEqual({ success: true });
    expect(Object.keys(result)).toEqual(["success"]);
    await expect(repo.findById("123456")).resolves.toMatchObject({
      status: "finished",
      currentQuestionIndex: 2,
    });
  });

  it("POST /api/games/[gameId]/finish — sin preguntas el índice queda en -1", async () => {
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [],
      creatorId: "creator-1",
      status: "active",
      currentQuestionIndex: 0,
      createdAt: CREATED_AT,
      players: [],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createFinishGameUseCase({ games: repo });

    await expect(useCase.execute({ gameId: "123456" })).resolves.toEqual({
      success: true,
    });
    await expect(repo.findById("123456")).resolves.toMatchObject({
      status: "finished",
      currentQuestionIndex: -1,
    });
  });

  // Referencia: `legacy-results-contract.test.ts` → "percentage se redondea al
  // entero (33 y 67) y averageScore NO se redondea (100.5)".
  it("GET /api/games/[gameId]/results — crudo en el use case y redondeo 33/67 en el DTO", async () => {
    const q1 = mongoQuestion("q1", "Pregunta 1", 0);
    const q2 = mongoQuestion("q2", "Pregunta 2", 1);
    const q3 = mongoQuestion("q3", "Pregunta 3", 2);
    const doc: GameDoc = {
      gameCode: "123456",
      name: "Geografía",
      questions: [q1, q2, q3],
      creatorId: "creator-1",
      status: "finished",
      currentQuestionIndex: 2,
      createdAt: CREATED_AT,
      players: [
        {
          id: "p1",
          name: "Ana",
          gameId: "123456",
          answers: { q1: 0, q2: 9, q3: 9 },
          score: 100,
          joinedAt: CREATED_AT,
        },
        {
          id: "p2",
          name: "Beto",
          gameId: "123456",
          answers: { q1: 0, q2: 1 },
          score: 101,
          joinedAt: CREATED_AT,
        },
      ],
    };
    const repo = createInMemoryGameRepository([toDomain(doc)]);
    const useCase = createGetResultsUseCase({ games: repo });

    const raw = await useCase.execute({ gameId: "123456" });

    // El caso de uso devuelve el porcentaje CRUDO; el DTO redondea.
    expect(raw.leaderboard[0].percentage).toBeCloseTo(33.33333333333333);
    expect(raw.leaderboard[1].percentage).toBeCloseTo(66.66666666666666);
    expect(raw.averageScore).toBe(100.5);

    const response = { results: toResultsDto(raw) };

    expect(response).toEqual({
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
            questionText: "Pregunta 1",
            correctAnswer: 0,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 0, isCorrect: true },
              { playerId: "p2", name: "Beto", answer: 0, isCorrect: true },
            ],
          },
          {
            questionId: "q2",
            questionText: "Pregunta 2",
            correctAnswer: 1,
            playerAnswers: [
              { playerId: "p1", name: "Ana", answer: 9, isCorrect: false },
              { playerId: "p2", name: "Beto", answer: 1, isCorrect: true },
            ],
          },
          {
            questionId: "q3",
            questionText: "Pregunta 3",
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
    expect(Object.keys(response.results.leaderboard[1])).toContain("avatar");
    expect(response.results.leaderboard[1].avatar).toBeUndefined();
  });
});
