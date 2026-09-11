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

export interface GameRepository {
  existsByCode(gameCode: string): Promise<boolean>;
  findById(gameId: string): Promise<Game | null>;
  listRecent(): Promise<Game[]>; // createdAt desc, sin límite (legacy: Game.find().sort)
  create(game: NewGame): Promise<Game>; // devuelve el Game persistido (ids de preguntas reales)
  addPlayer(gameId: string, player: Player): Promise<Game | null>;
  setStatusAndIndex(gameId: string, update: GameProgressUpdate): Promise<Game | null>;
}
