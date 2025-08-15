// Application constants
export const GAME_CONFIG = {
  MAX_PLAYERS: 50,
  MIN_PLAYERS: 1,
  GAME_TIMEOUT: 5 * 60 * 1000, // 5 minutes in milliseconds
  ANSWER_OPTIONS: 4,
} as const

export const GAME_STATUS = {
  WAITING: "waiting",
  ACTIVE: "active",
  FINISHED: "finished",
} as const

export const SOCKET_EVENTS = {
  // Client to Server
  JOIN_GAME: "join-game",
  SUBMIT_ANSWER: "submit-answer",
  START_GAME: "start-game",
  FINISH_GAME: "finish-game",

  // Server to Client
  PLAYER_JOINED: "player-joined",
  GAME_STARTED: "game-started",
  ANSWER_SUBMITTED: "answer-submitted",
  GAME_FINISHED: "game-finished",
  ERROR: "error",
} as const

export const API_ROUTES = {
  GAMES: "/api/games",
  JOIN_GAME: "/api/games/join",
  SUBMIT_ANSWER: "/api/games/answer",
  SOCKET: "/api/socket",
} as const
