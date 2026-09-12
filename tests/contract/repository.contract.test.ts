/**
 * Suite de contrato compartida de `GameRepository` (US-18, design §D10).
 *
 * Congela la semántica de portabilidad del puerto (identidad `Game.id` ===
 * `gameCode`, update-only, patch parcial de `setStatusAndIndex`, unicidad de
 * `create`, orden `createdAt` desc y "solo los métodos del puerto persisten")
 * contra dos implementaciones:
 * - `createInMemoryGameRepository()` — corre siempre.
 * - `createMongoGameRepository(...)` — `skipIf(!MONGODB_URI_TEST)`, códigos con
 *   prefijo `up18-`, `GameModel.init()` para garantizar el índice unique y
 *   limpieza + `disconnect` en `afterAll`.
 *
 * Paridad fake/Mongo y diferencias declaradas:
 * - `seedGame` es específico de cada variante: el fake siembra con `create`
 *   (su única vía de alta, ya que no expone `seed()`); Mongo escribe el
 *   documento crudo con `GameModel.create`, sin pasar por el adaptador.
 * - Caso (8): ambos verifican que re-leer `findById` devuelve el original tras
 *   mutar la copia devuelta. Solo Mongo añade `verifyPersistedUnchanged` contra
 *   `GameModel.findOne(...).lean()`: la comprobación fuerte de que la mutación
 *   no llegó al documento crudo (el adaptador podría servir el `Game` desde
 *   una referencia viva de su caché; el aliasing NO es contrato).
 * - El duplicado se expresa igual en ambos: la promesa de `create` rechaza
 *   (el fake lanza `Duplicate gameCode ...`; Mongo responde E11000).
 *
 * El stack Mongo se importa de forma diferida: sin `MONGODB_URI_TEST` la
 * variante queda skipped y `mongoose` no se carga en el gate por defecto.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { Game } from "@/core/domain/game";
import type { Player } from "@/core/domain/player";
import type {
  GameRepository,
  NewGame,
} from "@/core/application/ports/game-repository";
import type { GameDoc } from "@/adapters/persistence/mongo/game.mapper";
import { createInMemoryGameRepository } from "@/tests/fakes/in-memory-game-repository";

/** Imports diferidos del bloque Mongo (no se ejecutan si la suite queda skipped). */
async function importMongoStack() {
  const [connection, repository, schema] = await Promise.all([
    import("@/adapters/persistence/mongo/connection"),
    import("@/adapters/persistence/mongo/game-repository.mongo"),
    import("@/adapters/persistence/mongo/game.schema"),
  ]);
  return {
    connectToMongo: connection.connectToMongo,
    createMongoGameRepository: repository.createMongoGameRepository,
    GameModel: schema.GameModel,
  };
}

const GAME_CODE_PREFIX = "up18-";

// ---------------------------------------------------------------------------
// Fixtures locales (no se crean builders nuevos)
// ---------------------------------------------------------------------------

const CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const JOINED_AT = new Date("2026-01-15T12:05:00.000Z");

function gameFixture(id: string, overrides: Partial<Game> = {}): Game {
  return {
    id,
    name: "Partida de contrato",
    questions: [
      {
        id: "q-fija",
        text: "Pregunta única",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        image: null,
      },
    ],
    createdAt: CREATED_AT,
    creatorId: "creator-1",
    status: "waiting",
    currentQuestionIndex: 0,
    players: [],
    currentQuestionStartTime: 0,
    questionTimeLimit: DEFAULT_TIME_LIMIT_MS,
    locked: false,
    ...overrides,
  };
}

function newGameFixture(id: string, overrides: Partial<NewGame> = {}): NewGame {
  return {
    ...gameFixture(id),
    questions: [
      {
        text: "Pregunta 1",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        image: null,
      },
      {
        text: "Pregunta 2",
        options: ["A", "B", "C", "D"],
        correctAnswer: 1,
      },
    ],
    ...overrides,
  };
}

function playerFixture(
  id: string,
  gameId: string,
  overrides: Partial<Player> = {}
): Player {
  return {
    id,
    name: "Ana",
    gameId,
    answers: { "q-fija": 0 },
    score: 0,
    joinedAt: JOINED_AT,
    ...overrides,
  };
}

/** `Game` (con ids de pregunta) → `NewGame` (sin ids): la única alta del puerto. */
function toNewGame(game: Game): NewGame {
  return {
    ...game,
    questions: game.questions.map((question) => ({
      text: question.text,
      options: question.options,
      correctAnswer: question.correctAnswer,
      image: question.image ?? null,
    })),
  };
}

interface RepositoryContractOptions {
  createRepo: () => Promise<GameRepository> | GameRepository;
  seedGame: (repo: GameRepository, game: Game) => Promise<void>;
  /**
   * Solo variantes con almacenamiento externo: verifica que la mutación del
   * `Game` devuelto por `findById` no llegó al almacenamiento (documento crudo).
   */
  verifyPersistedUnchanged?: (gameId: string, original: Game) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Casos compartidos
// ---------------------------------------------------------------------------

function describeRepositoryContract(
  label: string,
  options: RepositoryContractOptions
): void {
  describe(`GameRepository contract — ${label}`, () => {
    // `runId` + secuencia: códigos únicos por ejecución y por test (prefijo `up18-`).
    const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    let sequence = 0;
    let repo: GameRepository;

    const nextCode = () => `${GAME_CODE_PREFIX}${label}-${runId}-${++sequence}`;

    beforeEach(async () => {
      repo = await options.createRepo();
    });

    it("(1) existsByCode distingue hit de miss", async () => {
      const code = nextCode();
      expect(await repo.existsByCode(code)).toBe(false);

      await options.seedGame(repo, gameFixture(code));
      expect(await repo.existsByCode(code)).toBe(true);
    });

    it("(2) findById devuelve null en miss y la partida con id === gameCode en hit", async () => {
      const code = nextCode();
      await options.seedGame(repo, gameFixture(code));

      expect(await repo.findById(`${code}-missing`)).toBeNull();

      const found = await repo.findById(code);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(code);
    });

    it("(3) create devuelve ids de pregunta no vacíos y arranca con players vacío", async () => {
      const code = nextCode();
      const created = await repo.create(newGameFixture(code));

      expect(created.id).toBe(code);
      expect(created.questions).toHaveLength(2);
      for (const question of created.questions) {
        expect(typeof question.id).toBe("string");
        expect(question.id).not.toBe("");
      }
      expect(created.players).toEqual([]);
      expect(await repo.existsByCode(code)).toBe(true);
    });

    it("(4) create rechaza un gameCode repetido (unicidad)", async () => {
      const code = nextCode();
      await options.seedGame(repo, gameFixture(code));

      await expect(repo.create(newGameFixture(code))).rejects.toThrow(
        /duplicate/i
      );

      expect(await repo.existsByCode(code)).toBe(true);
    });

    it("(5) listRecent ordena por createdAt descendente", async () => {
      const base = Date.parse("2026-01-01T00:00:00.000Z");
      const oldest = nextCode();
      const middle = nextCode();
      const newest = nextCode();
      await options.seedGame(
        repo,
        gameFixture(oldest, { createdAt: new Date(base) })
      );
      await options.seedGame(
        repo,
        gameFixture(middle, { createdAt: new Date(base + 1000) })
      );
      await options.seedGame(
        repo,
        gameFixture(newest, { createdAt: new Date(base + 2000) })
      );

      // La base Mongo puede compartirse con otras suites: se compara solo lo sembrado aquí.
      const ids = (await repo.listRecent())
        .map((game) => game.id)
        .filter((id) => id.startsWith(GAME_CODE_PREFIX));

      expect(ids).toContain(oldest);
      expect(ids).toContain(middle);
      expect(ids).toContain(newest);
      expect(ids.indexOf(newest)).toBeLessThan(ids.indexOf(middle));
      expect(ids.indexOf(middle)).toBeLessThan(ids.indexOf(oldest));
    });

    it("(6) addPlayer agrega al final y devuelve null si la partida no existe", async () => {
      const code = nextCode();
      const first = playerFixture(`${code}-p1`, code);
      const second = playerFixture(`${code}-p2`, code);
      await options.seedGame(repo, gameFixture(code, { players: [first] }));

      const updated = await repo.addPlayer(code, second);
      expect(updated).not.toBeNull();
      expect(updated!.players.map((player) => player.id)).toEqual([
        first.id,
        second.id,
      ]);

      const found = await repo.findById(code);
      expect(found!.players.map((player) => player.id)).toEqual([
        first.id,
        second.id,
      ]);
      expect(found!.players[1]).toMatchObject({
        id: second.id,
        name: second.name,
        score: second.score,
        answers: second.answers,
      });

      await expect(repo.addPlayer(`${code}-missing`, second)).resolves.toBeNull();
    });

    it("(7) setStatusAndIndex pisa status/índice, respeta el patch parcial y null en miss", async () => {
      const code = nextCode();
      await options.seedGame(
        repo,
        gameFixture(code, {
          status: "waiting",
          currentQuestionIndex: 0,
          currentQuestionStartTime: 1111,
          questionTimeLimit: 30000,
        })
      );

      // Sin `questionTimeLimit`: el persistido (30000) no se pisa.
      const started = await repo.setStatusAndIndex(code, {
        status: "active",
        currentQuestionIndex: 1,
        currentQuestionStartTime: 1234,
      });
      expect(started).toMatchObject({
        status: "active",
        currentQuestionIndex: 1,
        currentQuestionStartTime: 1234,
        questionTimeLimit: 30000,
      });

      // Sin `currentQuestionStartTime`: el persistido (1234) no se pisa.
      const continued = await repo.setStatusAndIndex(code, {
        status: "active",
        currentQuestionIndex: 2,
        questionTimeLimit: 40000,
      });
      expect(continued).toMatchObject({
        status: "active",
        currentQuestionIndex: 2,
        currentQuestionStartTime: 1234,
        questionTimeLimit: 40000,
      });

      // Patch mínimo: ambos opcionales conservan su último valor.
      const finished = await repo.setStatusAndIndex(code, {
        status: "finished",
        currentQuestionIndex: -1,
      });
      expect(finished).toMatchObject({
        status: "finished",
        currentQuestionIndex: -1,
        currentQuestionStartTime: 1234,
        questionTimeLimit: 40000,
      });

      expect(await repo.findById(code)).toMatchObject({
        status: "finished",
        currentQuestionIndex: -1,
        currentQuestionStartTime: 1234,
        questionTimeLimit: 40000,
      });

      await expect(
        repo.setStatusAndIndex(`${code}-missing`, {
          status: "finished",
          currentQuestionIndex: -1,
        })
      ).resolves.toBeNull();
    });

    it("(8) mutar el Game devuelto por findById no persiste", async () => {
      const code = nextCode();
      const original = gameFixture(code, {
        name: "Nombre original",
        status: "waiting",
        currentQuestionIndex: 0,
        players: [playerFixture(`${code}-p1`, code)],
      });
      await options.seedGame(repo, original);

      const returned = await repo.findById(code);
      expect(returned).not.toBeNull();
      returned!.name = "Mutado";
      returned!.status = "finished";
      returned!.currentQuestionIndex = 9;
      returned!.createdAt.setTime(0);
      returned!.players.push(playerFixture(`${code}-intruso`, code));
      returned!.players[0].answers["q-fija"] = 3;

      const reread = await repo.findById(code);
      expect(reread).not.toBeNull();
      expect(reread!.name).toBe("Nombre original");
      expect(reread!.status).toBe("waiting");
      expect(reread!.currentQuestionIndex).toBe(0);
      expect(reread!.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(reread!.players).toHaveLength(1);
      expect(reread!.players[0].id).toBe(`${code}-p1`);
      expect(reread!.players[0].answers).toEqual({ "q-fija": 0 });

      // Solo variantes con almacenamiento externo: documento crudo sin caché ni mapeo.
      if (options.verifyPersistedUnchanged) {
        await options.verifyPersistedUnchanged(code, original);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Variante 1: fake en memoria (siempre verde, sin IO)
// ---------------------------------------------------------------------------

async function seedInMemoryGame(repo: GameRepository, game: Game): Promise<void> {
  await repo.create(toNewGame(game));
}

describe("InMemoryGameRepository", () => {
  describeRepositoryContract("in-memory", {
    createRepo: () => createInMemoryGameRepository(),
    seedGame: seedInMemoryGame,
  });
});

// ---------------------------------------------------------------------------
// Variante 2: adaptador Mongo (skip sin `MONGODB_URI_TEST`)
// ---------------------------------------------------------------------------

// Como el fake no expone `seed()`, Mongo siembra el documento crudo, igual que
// la suite de contrato de QuizUpWebSocket (independiente del `create` bajo test).
async function seedMongoGame(_repo: GameRepository, game: Game): Promise<void> {
  const { GameModel } = await importMongoStack();
  await GameModel.create({
    name: game.name,
    gameCode: game.id,
    questions: game.questions.map((question) => ({
      text: question.text,
      options: question.options,
      correctAnswer: question.correctAnswer,
      image: question.image ?? null,
    })),
    createdAt: game.createdAt,
    creatorId: game.creatorId,
    status: game.status,
    currentQuestionIndex: game.currentQuestionIndex,
    currentQuestionStartTime: game.currentQuestionStartTime,
    questionTimeLimit: game.questionTimeLimit,
    locked: game.locked ?? false,
    players: game.players.map((player) => ({
      id: player.id,
      name: player.name,
      gameId: player.gameId,
      answers: { ...player.answers },
      score: player.score,
      joinedAt: player.joinedAt,
      avatar: player.avatar ?? null,
    })),
  });
}

/** Verificación Mongo del caso (8): el documento crudo conserva el original. */
async function verifyMongoUnchanged(
  gameId: string,
  original: Game
): Promise<void> {
  const { GameModel } = await importMongoStack();
  const doc = await GameModel.findOne({ gameCode: gameId }).lean<GameDoc | null>();
  expect(doc).not.toBeNull();
  expect(doc!.name).toBe(original.name);
  expect(doc!.status).toBe(original.status);
  expect(doc!.currentQuestionIndex).toBe(original.currentQuestionIndex);
  expect(doc!.createdAt.getTime()).toBe(original.createdAt.getTime());
  expect(doc!.players ?? []).toHaveLength(original.players.length);
  expect((doc!.players ?? []).map((player) => player.id)).toEqual(
    original.players.map((player) => player.id)
  );
}

describe.skipIf(!process.env.MONGODB_URI_TEST)("MongoGameRepository", () => {
  beforeAll(async () => {
    const { connectToMongo, GameModel } = await importMongoStack();
    await connectToMongo(process.env.MONGODB_URI_TEST!);
    // Garantiza el índice unique de `gameCode` antes del caso (4).
    await GameModel.init();
  });

  afterAll(async () => {
    const { GameModel } = await importMongoStack();
    const { default: mongoose } = await import("mongoose");
    await GameModel.deleteMany({ gameCode: { $regex: /^up18-/ } });
    await mongoose.disconnect();
  });

  describeRepositoryContract("mongo", {
    createRepo: async () => {
      const { connectToMongo, createMongoGameRepository } =
        await importMongoStack();
      return createMongoGameRepository({
        connect: () => connectToMongo(process.env.MONGODB_URI_TEST!),
      });
    },
    seedGame: seedMongoGame,
    verifyPersistedUnchanged: verifyMongoUnchanged,
  });
});
