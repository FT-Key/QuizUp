import type { Game, GameStatus } from "../../domain/game";
import type { Player } from "../../domain/player";
import type { QuestionImage } from "../../domain/question";

/** Pregunta de una partida aún no persistida (sin `id`: Mongo asigna `_id` al insertar). */
export interface NewGameQuestion {
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
  image?: QuestionImage | null;
}

/** Datos de creación: igual que `Game` pero con preguntas sin `id` (identidad la da Mongo). */
export type NewGame = Omit<Game, "questions"> & { questions: NewGameQuestion[] };

/** Campos de ciclo de vida que persiste `setStatusAndIndex` (start/finish). */
export interface GameProgressUpdate {
  status: GameStatus;
  currentQuestionIndex: number;
  currentQuestionStartTime?: number;
  questionTimeLimit?: number;
}

/**
 * Persistencia del agregado `Game` (puerto de `core`, US-11).
 *
 * Semántica común a todas las implementaciones, congelada por
 * `tests/contract/repository.contract.test.ts`:
 * - Identidad: `Game.id` == `gameCode` (6 dígitos, único en Mongo).
 * - Se persiste SOLO con los métodos del puerto: mutar el `Game` devuelto no
 *   persiste (cada implementación puede devolver copia o referencia; el
 *   aliasing NO es contrato).
 * - Update-only: `addPlayer`/`setStatusAndIndex` devuelven `null` si la partida
 *   no existe; `create` es la única alta.
 * - Los errores de infraestructura suben sin capturar (el mapeo a DomainError
 *   vive en `core`).
 * - `questionTimeLimit` válido es uno de `TIME_LIMIT_OPTIONS`
 *   (20000 | 30000 | 40000). El puerto **no define `0`** (dato inválido): el
 *   adaptador Mongo lo normaliza al default de creación (mapper
 *   `|| DEFAULT_TIME_LIMIT_MS`), mientras el fake en memoria conserva lo
 *   recibido.
 */
export interface GameRepository {
  /** `true` si existe una partida con ese `gameCode`. */
  existsByCode(gameCode: string): Promise<boolean>;
  /** Partida por `gameCode`; `null` si no existe. */
  findById(gameId: string): Promise<Game | null>;
  /** Todas las partidas, `createdAt` descendente, sin límite (dashboard). */
  listRecent(): Promise<Game[]>;
  /**
   * Persiste una partida nueva y devuelve la copia persistida con los ids
   * reales de las preguntas (ObjectId → string en Mongo; sintéticos en el
   * fake). Falla si `gameCode` ya existe (índice unique).
   */
  create(game: NewGame): Promise<Game>;
  /**
   * Alta de un jugador al final de `players` (`$push` en Mongo, push en el
   * fake). No valida nombre duplicado ni `locked`: esas reglas viven en el
   * caso de uso. `null` si la partida no existe.
   */
  addPlayer(gameId: string, player: Player): Promise<Game | null>;
  /**
   * Patch parcial del ciclo de vida: `status` y `currentQuestionIndex` siempre;
   * `currentQuestionStartTime`/`questionTimeLimit` solo si vienen definidos
   * (`undefined` no los pisa). `null` si la partida no existe.
   */
  setStatusAndIndex(gameId: string, update: GameProgressUpdate): Promise<Game | null>;
}
