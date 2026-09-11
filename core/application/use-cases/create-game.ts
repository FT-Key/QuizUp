import { DEFAULT_TIME_LIMIT_MS } from "@/constants/game";
import type { Game } from "../../domain/game";
import { ValidationError } from "../../domain/errors";
import type {
  GameRepository,
  NewGame,
  NewGameQuestion,
} from "../ports/game-repository";
import type { GameCodeGenerator } from "../ports/game-code-generator";
import type { IdGenerator } from "../ports/id-generator";
import type { Clock } from "../ports/clock";

// US-11 §5: creación de partida. La unicidad del código es una regla de
// negocio del caso de uso (hasta 10 intentos contra `existsByCode`); el
// generador del adapter es puro y el repo solo crea.

export interface CreateGameInput {
  name: string;
  questions: NewGameQuestion[];
  questionTimeLimit?: number;
}

export interface CreateGameDeps {
  games: GameRepository;
  gameCodes: GameCodeGenerator;
  ids: IdGenerator;
  clock: Clock;
}

export interface CreateGameUseCase {
  execute(input: CreateGameInput): Promise<Game>;
}

const MAX_CODE_ATTEMPTS = 10;

export function createCreateGameUseCase(deps: CreateGameDeps): CreateGameUseCase {
  return {
    async execute(input: CreateGameInput): Promise<Game> {
      if (!input.name) {
        throw new ValidationError("Missing required fields");
      }

      let code: string | null = null;
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const candidate = deps.gameCodes.generate();
        if (!(await deps.games.existsByCode(candidate))) {
          code = candidate;
          break;
        }
      }

      if (code === null) {
        throw new Error("Failed to generate unique game code after 10 attempts");
      }

      const newGame: NewGame = {
        id: code,
        name: input.name,
        questions: input.questions,
        createdAt: new Date(deps.clock.now()),
        creatorId: deps.ids.next(),
        status: "waiting",
        currentQuestionIndex: 0,
        players: [],
        currentQuestionStartTime: 0,
        questionTimeLimit: input.questionTimeLimit || DEFAULT_TIME_LIMIT_MS,
        locked: false,
      };

      return deps.games.create(newGame);
    },
  };
}
