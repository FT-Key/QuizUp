export interface Question {
  id: string;
  text: string;
  options: [string, string, string, string]; // Fixed to exactly 4 options
  correctAnswer: number; // Index of correct option (0-3)
}

export interface Game {
  id: string;
  name: string;
  questions: Question[]; // Changed from single question to multiple questions
  createdAt: Date;
  creatorId: string;
  status: "waiting" | "active" | "finished";
  currentQuestionIndex: number; // Added to track current question in active games
  players: Player[];
}

export interface Player {
  id: string;
  name: string;
  gameId: string;
  answers: { [questionId: string]: number }; // Changed to track answers for multiple questions
  score: number; // Added to track player's total score
  joinedAt: Date;
}

export interface GameState {
  game: Game;
  players: Player[];
  currentQuestion?: Question; // Added current question for active games
  results?: GameResults; // Added results for finished games
}

export interface CreateGameData {
  name: string;
  questions: Array<{
    // Changed to support multiple questions
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

/* export interface GameResults {
  totalPlayers: number
  totalQuestions: number // Added total questions count
  leaderboard: Array<{
    // Enhanced results with leaderboard
    playerId: string
    name: string
    score: number
    correctAnswers: number
    percentage: number
  }>
  questionResults: Array<{
    // Added per-question results
    questionId: string
    questionText: string
    correctAnswer: number
    playerAnswers: Array<{
      playerId: string
      name: string
      answer: number
      isCorrect: boolean
    }>
  }>
} */

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
}
