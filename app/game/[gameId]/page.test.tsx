/**
 * CARACTERIZACIÓN US-14 — `app/game/[gameId]/page.tsx`.
 *
 * Congela la máquina de fases (`syncPhaseFromGame`), el join embebido, los
 * eventos emitidos y cada panel visible, antes de extraer `resolveGamePhase`,
 * los paneles por fase, `PlayerJoinForm` y `useGameSession`.
 *
 * Mockea `next/navigation`, `@/hooks/useSocket` (capturando `options.events`),
 * `QuestionCard`, `Scoreboard`, `Results` y `AvatarSelector`. La sesión del
 * jugador es la real sobre localStorage. Nada de red/socket reales.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Game, GameResults, Player, Question } from "@/types";
import GamePage from "./page";

const GAME_ID = "123456";

type SocketEvent = {
  event: string;
  callback: (...args: any[]) => void;
};

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  events: [] as SocketEvent[],
  questionCard: null as null | {
    question: Question;
    onAnswerSubmit: (answer: number) => void;
  },
  scoreboard: null as null | {
    entries: unknown[];
    currentPlayerId?: string;
  },
  results: null as null | { gameId: string; results?: GameResults | null },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ gameId: "123456" }),
}));

vi.mock("@/hooks/useSocket", () => ({
  useSocket: (options: { events: SocketEvent[] }) => {
    mocks.events = options.events;
    return { emit: mocks.emit, connected: true };
  },
}));

vi.mock("@/components/QuestionCard", () => ({
  QuestionCard: (props: {
    question: Question;
    onAnswerSubmit: (answer: number) => void;
  }) => {
    mocks.questionCard = props;
    return (
      <button type="button" onClick={() => props.onAnswerSubmit(2)}>
        responder-2
      </button>
    );
  },
}));

vi.mock("@/components/Scoreboard", () => ({
  Scoreboard: (props: { entries: unknown[]; currentPlayerId?: string }) => {
    mocks.scoreboard = props;
    return <div>scoreboard-mock</div>;
  },
}));

vi.mock("@/components/Results", () => ({
  Results: (props: { gameId: string; results?: GameResults | null }) => {
    mocks.results = props;
    return <div>results-mock</div>;
  },
}));

vi.mock("@/components/AvatarSelector", () => ({
  AvatarSelector: ({
    onSelect,
  }: {
    onSelect: (seed: string, accessories?: string[]) => void;
  }) => (
    <button type="button" onClick={() => onSelect("Felix", ["sunglasses", "none"])}>
      elegir-avatar
    </button>
  ),
}));

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFunction>>;
let alertSpy: ReturnType<typeof vi.spyOn>;

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response;

const makePlayer = (id: string, overrides: Partial<Player> = {}): Player => ({
  id,
  name: id === "p1" ? "Ana" : "Beto",
  gameId: GAME_ID,
  answers: {},
  score: 0,
  joinedAt: new Date(0),
  ...overrides,
});

const makeQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: "q1",
  text: "¿2+2?",
  options: ["1", "2", "3", "4"],
  correctAnswer: 3,
  image: null,
  ...overrides,
});

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: GAME_ID,
  name: "Trivia de prueba",
  questions: [makeQuestion()],
  createdAt: new Date(0),
  creatorId: "admin",
  status: "waiting",
  currentQuestionIndex: 0,
  players: [],
  currentQuestionStartTime: 0,
  questionTimeLimit: 30000,
  ...overrides,
});

const setSession = (
  playerId: string,
  playerName: string,
  seed?: string,
  accessories?: string[]
) => {
  localStorage.setItem("playerId", playerId);
  localStorage.setItem("playerName", playerName);
  if (seed) localStorage.setItem("playerAvatarSeed", seed);
  if (accessories) {
    localStorage.setItem("playerAvatarAccessories", JSON.stringify(accessories));
  }
};

const trigger = async (event: string, payload?: unknown) => {
  const entry = mocks.events.find((e) => e.event === event);
  if (!entry) throw new Error(`evento ${event} no capturado por useSocket`);
  await act(async () => {
    entry.callback(payload);
  });
};

beforeEach(() => {
  localStorage.clear();
  mocks.emit.mockReset();
  mocks.events = [];
  mocks.questionCard = null;
  mocks.scoreboard = null;
  mocks.results = null;
  fetchMock = vi.fn<FetchFunction>();
  vi.stubGlobal("fetch", fetchMock);
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GamePage (caracterización US-14)", () => {
  it("muestra 'Loading game...' y al cargar pinta el header y emite join-game", async () => {
    setSession("p1", "Ana", "Felix", ["sunglasses", "none"]);
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );

    render(<GamePage />);
    expect(screen.getByText("Loading game...")).toBeTruthy();

    await screen.findByText("Trivia de prueba");
    expect(screen.getByText("1 players")).toBeTruthy();
    expect(screen.getByText("waiting")).toBeTruthy();
    expect(screen.getByText("Waiting for the game to start...")).toBeTruthy();
    expect(screen.getByText("The host will start the quiz soon")).toBeTruthy();

    expect(mocks.emit).toHaveBeenCalledWith("join-game", {
      gameId: GAME_ID,
      playerId: "p1",
      avatar: { seed: "Felix", accessories: ["sunglasses"] },
    });
  });

  it("si el GET inicial falla muestra el panel de Error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));

    render(<GamePage />);

    await screen.findByText("Error");
    expect(screen.getByText("Failed to load game")).toBeTruthy();
  });

  it("status cancelled muestra el cierre del anfitrión y el link de inicio", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "cancelled",
          players: [makePlayer("p1")],
        }),
      })
    );

    render(<GamePage />);

    await screen.findByText("El anfitrión cerró la partida");
    expect(screen.getByText("Esta partida nunca se inició.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href")
    ).toBe("/");
  });

  it("sin jugador ni sesión muestra 'Join the Quiz' y el flujo nombre → avatar emite join-game", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame({ players: [] }) }));

    render(<GamePage />);

    await screen.findByText("Join the Quiz");
    const next = screen.getByRole("button", { name: "SIGUIENTE" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Enter a display name..."), {
      target: { value: "Carla" },
    });
    expect(next.disabled).toBe(false);
    fireEvent.click(next);

    fireEvent.click(screen.getByRole("button", { name: "elegir-avatar" }));
    fireEvent.click(screen.getByRole("button", { name: "JOIN GAME" }));

    expect(mocks.emit).toHaveBeenCalledWith("join-game", {
      gameId: GAME_ID,
      playerName: "Carla",
      avatar: { seed: "Felix", accessories: ["sunglasses"] },
    });
    expect(localStorage.getItem("playerName")).toBe("Carla");
  });

  it("status active con pregunta y sin responder renderiza QuestionCard y responde con submit-answer exacto", async () => {
    setSession("p1", "Ana");
    const question = makeQuestion({ id: "q7", correctAnswer: 1 });
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          questions: [question],
          players: [makePlayer("p1")],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );

    render(<GamePage />);

    const answerButton = await screen.findByRole("button", { name: "responder-2" });
    expect(mocks.questionCard?.question).toEqual(question);

    fireEvent.click(answerButton);

    expect(mocks.emit).toHaveBeenCalledWith("submit-answer", {
      gameId: GAME_ID,
      playerId: "p1",
      questionId: "q7",
      answer: 2,
    });
    expect(await screen.findByText("¡Respuesta enviada!")).toBeTruthy();
  });

  it("en fase question con respuesta propia muestra '¡Respuesta enviada!' y oculta QuestionCard", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [
            makePlayer("p1", { answers: { q1: 0 }, score: 120 }),
            makePlayer("p2"),
          ],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );

    render(<GamePage />);

    await screen.findByText("¡Respuesta enviada!");
    expect(screen.getByText("Esperando a los demás jugadores...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "responder-2" })).toBeNull();
  });

  it("question-finished pasa a showing-result, pide game-state y muestra el resultado correcto", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [
            makePlayer("p1", { answers: { q1: 3 }, score: 120 }),
            makePlayer("p2"),
          ],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );

    render(<GamePage />);
    await screen.findByText("¡Respuesta enviada!");

    await trigger("question-finished", { currentQuestionIndex: 0 });

    expect(mocks.emit).toHaveBeenCalledWith("request-game-state", {
      gameId: GAME_ID,
    });
    expect(await screen.findByText("✅ ¡Correcto!")).toBeTruthy();
    expect(screen.getByText("+120 puntos")).toBeTruthy();
  });

  it("CARACTERIZACIÓN: si todos respondieron al cargar pasa directo a showing-result", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [
            makePlayer("p1", { answers: { q1: 3 }, score: 120 }),
            makePlayer("p2", { answers: { q1: 0 }, score: 0 }),
          ],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );

    render(<GamePage />);

    expect(await screen.findByText("✅ ¡Correcto!")).toBeTruthy();
    expect(screen.getByText("+120 puntos")).toBeTruthy();
  });

  it("question-finished con respuesta incorrecta muestra '❌ Incorrecto'", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [makePlayer("p1", { answers: { q1: 1 } }), makePlayer("p2")],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );

    render(<GamePage />);
    await screen.findByText("¡Respuesta enviada!");

    await trigger("question-finished", { currentQuestionIndex: 0 });

    expect(await screen.findByText("❌ Incorrecto")).toBeTruthy();
    expect(screen.getByText("Mejor suerte la próxima vez")).toBeTruthy();
  });

  it("sin respuesta y tiempo agotado muestra '⏰ ¡Tiempo!'", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [makePlayer("p1"), makePlayer("p2")],
          currentQuestionStartTime: Date.now() - 40000,
        }),
      })
    );

    render(<GamePage />);

    expect(await screen.findByText("⏰ ¡Tiempo!")).toBeTruthy();
    expect(screen.getByText("No enviaste respuesta")).toBeTruthy();
  });

  it("CARACTERIZACIÓN: con status distinto de active no evalúa la fase aunque haya respuesta", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "waiting",
          players: [makePlayer("p1", { answers: { q1: 3 }, score: 120 })],
          currentQuestionStartTime: Date.now() - 40000,
        }),
      })
    );

    render(<GamePage />);

    expect(await screen.findByText("Waiting for the game to start...")).toBeTruthy();
    expect(screen.queryByText("✅ ¡Correcto!")).toBeNull();
    expect(screen.queryByText("⏰ ¡Tiempo!")).toBeNull();
  });

  it("CARACTERIZACIÓN: currentQuestionStartTime === 0 se considera expirado", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [makePlayer("p1"), makePlayer("p2")],
          currentQuestionStartTime: 0,
        }),
      })
    );

    render(<GamePage />);

    expect(await screen.findByText("⏰ ¡Tiempo!")).toBeTruthy();
  });

  it("CARACTERIZACIÓN: sin questionTimeLimit se usa el default 30000 (31s ⇒ expirado)", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [makePlayer("p1")],
          currentQuestionStartTime: Date.now() - 31000,
          questionTimeLimit: undefined as unknown as number,
        }),
      })
    );

    render(<GamePage />);

    expect(await screen.findByText("⏰ ¡Tiempo!")).toBeTruthy();
  });

  it("CARACTERIZACIÓN: sin questionTimeLimit se usa el default 30000 (29s ⇒ sigue en question)", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [makePlayer("p1")],
          currentQuestionStartTime: Date.now() - 29000,
          questionTimeLimit: undefined as unknown as number,
        }),
      })
    );

    render(<GamePage />);

    expect(await screen.findByRole("button", { name: "responder-2" })).toBeTruthy();
  });

  it("tras 4000 ms en showing-result pasa a showing-scoreboard con entries ordenadas", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [
            makePlayer("p1", { answers: { q1: 3 }, score: 120 }),
            makePlayer("p2", { score: 300 }),
          ],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );

    render(<GamePage />);
    await screen.findByText("¡Respuesta enviada!");

    vi.useFakeTimers();
    await trigger("question-finished", { currentQuestionIndex: 0 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByText("scoreboard-mock")).toBeTruthy();
    expect(mocks.scoreboard?.currentPlayerId).toBe("p1");
    expect(mocks.scoreboard?.entries).toEqual([
      {
        playerId: "p2",
        name: "Beto",
        score: 300,
        previousPosition: 1,
        currentPosition: 0,
      },
      {
        playerId: "p1",
        name: "Ana",
        score: 120,
        previousPosition: 0,
        currentPosition: 1,
      },
    ]);
  });

  it("game-finished setea el juego terminado y pasa results a Results", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          players: [
            makePlayer("p1", { answers: { q1: 3 }, score: 120 }),
            makePlayer("p2"),
          ],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );

    render(<GamePage />);
    await screen.findByText("¡Respuesta enviada!");

    const finishedGame = makeGame({
      status: "finished",
      players: [makePlayer("p1", { score: 120 }), makePlayer("p2", { score: 40 })],
    });
    const results: GameResults = {
      gameId: GAME_ID,
      createdAt: new Date(0),
      totalPlayers: 2,
      totalQuestions: 1,
      leaderboard: [],
    };

    await trigger("game-finished", { game: finishedGame, results });

    expect(screen.getByText("results-mock")).toBeTruthy();
    expect(mocks.results).toEqual({ gameId: GAME_ID, results });
  });

  it("game-cancelled marca la partida como cancelled", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );

    render(<GamePage />);
    await screen.findByText("Waiting for the game to start...");

    await trigger("game-cancelled", {});

    expect(await screen.findByText("El anfitrión cerró la partida")).toBeTruthy();
  });

  it("join-error llama a window.alert con el mensaje del payload o el fallback", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );

    render(<GamePage />);
    await screen.findByText("Trivia de prueba");

    await trigger("join-error", { message: "Sala llena" });
    expect(alertSpy).toHaveBeenCalledWith("Sala llena");

    await trigger("join-error", {});
    expect(alertSpy).toHaveBeenCalledWith("Failed to join the game");
  });
});
