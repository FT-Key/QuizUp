import type {
  GameProgressUpdate,
  GameRepository,
  NewGame,
} from "@/core/application/ports/game-repository";
import type { Game } from "@/core/domain/game";
import type { Player } from "@/core/domain/player";
import {
  toDomain,
  toPersistence,
  toPersistencePlayer,
  type GameDoc,
} from "./game.mapper";
import { GameModel } from "./game.schema";

export interface MongoGameRepositoryDeps {
  /**
   * Conexión lazy inyectada (p. ej. `() => connectToMongo(config.mongoUri)`).
   * El repositorio NUNCA conecta al importar ni al construirse; cada método
   * la invoca primero. Un fallo de conexión/consulta sube sin capturar.
   */
  connect: () => Promise<unknown>;
}

/**
 * Implementación Mongo de `GameRepository` (US-11 §3.5). Paridad con las
 * consultas legacy: `findOne({ gameCode })`, `.lean()`, `$push` atómico para
 * `addPlayer` y `$set` para el ciclo de vida. Sin reglas de negocio.
 */
export function createMongoGameRepository(
  deps: MongoGameRepositoryDeps
): GameRepository {
  return {
    async existsByCode(gameCode: string): Promise<boolean> {
      await deps.connect();
      const found = await GameModel.exists({ gameCode });
      return found !== null;
    },

    async findById(gameId: string): Promise<Game | null> {
      await deps.connect();
      const doc = await GameModel.findOne({ gameCode: gameId }).lean<GameDoc>();
      return doc ? toDomain(doc) : null;
    },

    async listRecent(): Promise<Game[]> {
      await deps.connect();
      const docs = await GameModel.find()
        .sort({ createdAt: -1 })
        .lean<GameDoc[]>();
      return docs.map(toDomain);
    },

    async create(game: NewGame): Promise<Game> {
      await deps.connect();
      const doc = await GameModel.create(toPersistence(game));
      return toDomain(doc.toObject() as GameDoc);
    },

    async addPlayer(gameId: string, player: Player): Promise<Game | null> {
      await deps.connect();
      const doc = await GameModel.findOneAndUpdate(
        { gameCode: gameId },
        { $push: { players: toPersistencePlayer(player) } },
        { new: true }
      ).lean<GameDoc>();
      return doc ? toDomain(doc) : null;
    },

    async setStatusAndIndex(
      gameId: string,
      update: GameProgressUpdate
    ): Promise<Game | null> {
      await deps.connect();
      const $set: Record<string, string | number> = {
        status: update.status,
        currentQuestionIndex: update.currentQuestionIndex,
      };
      if (update.currentQuestionStartTime !== undefined) {
        $set.currentQuestionStartTime = update.currentQuestionStartTime;
      }
      if (update.questionTimeLimit !== undefined) {
        $set.questionTimeLimit = update.questionTimeLimit;
      }
      const doc = await GameModel.findOneAndUpdate(
        { gameCode: gameId },
        { $set },
        { new: true }
      ).lean<GameDoc>();
      return doc ? toDomain(doc) : null;
    },
  };
}
