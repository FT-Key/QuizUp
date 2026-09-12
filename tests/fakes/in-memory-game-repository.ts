import type {
  GameProgressUpdate,
  GameRepository,
  NewGame,
} from "@/core/application/ports/game-repository";
import type { Game } from "@/core/domain/game";
import type { Player } from "@/core/domain/player";
import type { Question } from "@/core/domain/question";

// US-11 §3.2: espejo semántico del `MongoGameRepository` sin IO.
// - `create` sintetiza ids de pregunta (como el `_id` de Mongo) y las registra.
// - `addPlayer`/`setStatusAndIndex` devuelven `null` si la partida no existe.
// - `listRecent` ordena desc por `createdAt`.
// - unicidad de `gameCode` como el índice unique del schema.
// - TODAS las entradas y salidas se clonan: nadie puede mutar el store por referencia.

function cloneQuestion(question: Question): Question {
  return {
    ...question,
    options: [...question.options] as [string, string, string, string],
    image: question.image ? { ...question.image } : question.image,
  };
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    answers: { ...player.answers },
    joinedAt: new Date(player.joinedAt.getTime()),
    avatar: player.avatar
      ? {
          ...player.avatar,
          accessories: player.avatar.accessories
            ? [...player.avatar.accessories]
            : undefined,
        }
      : undefined,
  };
}

function cloneGame(game: Game): Game {
  return {
    ...game,
    createdAt: new Date(game.createdAt.getTime()),
    questions: game.questions.map(cloneQuestion),
    players: game.players.map(clonePlayer),
  };
}

function duplicateError(gameId: string): Error {
  return new Error(`Duplicate gameCode "${gameId}" (unique index)`);
}

export function createInMemoryGameRepository(seed: Game[] = []): GameRepository {
  const games = new Map<string, Game>();
  let questionCounter = 0;

  const register = (game: Game): void => {
    if (games.has(game.id)) throw duplicateError(game.id);
    games.set(game.id, cloneGame(game));
  };

  for (const game of seed) register(game);

  return {
    async existsByCode(gameCode: string): Promise<boolean> {
      return games.has(gameCode);
    },

    async findById(gameId: string): Promise<Game | null> {
      const game = games.get(gameId);
      return game ? cloneGame(game) : null;
    },

    async listRecent(): Promise<Game[]> {
      return [...games.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(cloneGame);
    },

    async create(newGame: NewGame): Promise<Game> {
      if (games.has(newGame.id)) throw duplicateError(newGame.id);
      const game: Game = {
        ...newGame,
        questions: newGame.questions.map((question) => ({
          ...question,
          // Clon de `options`: el store no comparte el array con el input.
          options: [...question.options] as [string, string, string, string],
          // Id sintético por inserción, análogo al `_id` generado por Mongoose.
          id: `q-${++questionCounter}`,
          image: question.image ?? null,
        })),
        players: newGame.players.map(clonePlayer),
        createdAt: new Date(newGame.createdAt.getTime()),
      };
      games.set(game.id, game);
      return cloneGame(game);
    },

    async addPlayer(gameId: string, player: Player): Promise<Game | null> {
      const game = games.get(gameId);
      if (!game) return null;
      game.players.push(clonePlayer(player));
      return cloneGame(game);
    },

    async setStatusAndIndex(
      gameId: string,
      update: GameProgressUpdate
    ): Promise<Game | null> {
      const game = games.get(gameId);
      if (!game) return null;
      game.status = update.status;
      game.currentQuestionIndex = update.currentQuestionIndex;
      if (update.currentQuestionStartTime !== undefined) {
        game.currentQuestionStartTime = update.currentQuestionStartTime;
      }
      if (update.questionTimeLimit !== undefined) {
        game.questionTimeLimit = update.questionTimeLimit;
      }
      return cloneGame(game);
    },
  };
}
