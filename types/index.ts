export interface Question {
  id: string;
  text: string;
  options: [string, string, string, string]; // exactly 4 options
  correctAnswer: number; // index 0-3
}

export interface Game {
  id: string;
  name: string;
  questions: Question[];
  createdAt: Date;
  creatorId: string;
  status: "waiting" | "active" | "finished";
  currentQuestionIndex: number;
  players: Player[];
  currentQuestionStartTime: number; // timestamp en ms
  questionTimeLimit: number; // ms por pregunta
}

export interface Player {
  id: string;
  name: string;
  gameId: string;
  answers: { [questionId: string]: number };
  score: number;
  joinedAt: Date;
}

export interface GameState {
  game: Game;
  players: Player[];
  currentQuestion?: Question;
  results?: GameResults;
}

export interface CreateGameData {
  name: string;
  questions: Array<{
    text: string;
    options: [string, string, string, string];
    correctAnswer: number;
  }>;
}

export interface JoinGameData {
  gameId: string;
  playerName: string;
}

export interface SubmitAnswerData {
  gameId: string;
  playerId: string;
  questionId: string;
  answer: number;
}

export interface GameResults {
  gameId: string;
  createdAt: Date;
  totalPlayers: number;
  totalQuestions: number;
  leaderboard: Array<{
    playerId: string;
    name: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    percentage: number;
  }>;
  questionResults: Array<{
    questionId: string;
    questionText: string;
    correctAnswer: number;
    playerAnswers: Array<{
      playerId: string;
      name: string;
      answer: number;
      isCorrect: boolean;
    }>;
  }>;
  averageScore?: number;
}

export interface SocketEvents {
  "join-game": (data: { gameId: string; playerName: string }) => void;
  "join-admin": (gameId: string) => void;
  "player-joined": (data: { player: Player }) => void;
  "game-started": (data: GameState) => void;
  "question-changed": (data: {
    question: Question;
    questionIndex: number;
  }) => void;
  "answer-submitted": (data: {
    playerId: string;
    questionId: string;
    answer: number;
  }) => void;
  "game-finished": (data: { results: GameResults }) => void;
  "game-updated": (data: GameState) => void;
  "question-finished": (data: {
    gameId: string;
    questionIndex: number;
  }) => void;
}
