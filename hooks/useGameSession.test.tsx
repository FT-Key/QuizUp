/**
 * CARACTERIZACIÓN US-17 (BL-05) — `hooks/useGameSession.ts`.
 *
 * Congela el estado inicial, el fetch inicial (éxito / 404 / re-join con
 * sesión), los 9 eventos del socket, el timer de 4 s y las acciones
 * `join`/`submitAnswer` antes de dividir el hook por dominio (eventos/acciones).
 *
 * Mockea `@/hooks/useSocket` (capturando `options.events`) y `sonner`; la
 * sesión es la real sobre localStorage. Nada de red/socket reales.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Game, GameResults, Player, Question } from "@/types";
import { useGameSession } from "@/hooks/useGameSession";

const GAME_ID = "123456";

type SocketEvent = {
  event: string;
  callback: (...args: unknown[]) => void;
};

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  events: [] as SocketEvent[],
}));

const sonnerMock = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: sonnerMock.error } }));

vi.mock("@/hooks/useSocket", () => ({
  useSocket: (options: { events: SocketEvent[] }) => {
    mocks.events = options.events;
    return { emit: mocks.emit, connected: true };
  },
}));

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFunction>>;

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

const makeResults = (): GameResults => ({
  gameId: GAME_ID,
  createdAt: new Date(0),
  totalPlayers: 0,
  totalQuestions: 1,
  leaderboard: [],
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

/** Un game activo con pregunta en curso y dos jugadores (nadie respondió). */
const activeGame = (overrides: Partial<Game> = {}): Game =>
  makeGame({
    status: "active",
    players: [makePlayer("p1"), makePlayer("p2")],
    currentQuestionStartTime: Date.now() - 1000,
    ...overrides,
  });

const trigger = async (event: string, payload?: unknown) => {
  const entry = mocks.events.find((e) => e.event === event);
  if (!entry) throw new Error(`evento ${event} no capturado por useSocket`);
  await act(async () => {
    entry.callback(payload);
  });
};

const renderSession = () => renderHook(() => useGameSession(GAME_ID));

beforeEach(() => {
  localStorage.clear();
  mocks.emit.mockReset();
  mocks.events = [];
  sonnerMock.error.mockClear();
  fetchMock = vi.fn<FetchFunction>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useGameSession (caracterización US-17 BL-05)", () => {
  it("estado inicial: loading true, sin game/player, phase waiting y error vacío", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    const { result } = renderSession();

    expect(result.current.loading).toBe(true);
    expect(result.current.game).toBeNull();
    expect(result.current.player).toBeNull();
    expect(result.current.phase).toBe("waiting");
    expect(result.current.error).toBe("");
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.isQuestionFinished).toBe(false);
    expect(result.current.playerAnswerResult).toBeNull();
    expect(result.current.previousLeaderboard).toEqual([]);
    expect(result.current.results).toBeNull();
    expect(result.current.avatar).toEqual({ seed: "", accessories: [] });
  });

  it("el GET inicial exitoso carga el game y sin sesión no emite join-game", async () => {
    const game = makeGame();
    fetchMock.mockResolvedValue(jsonResponse({ game }));

    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(`/api/games/${GAME_ID}`);
    expect(result.current.game).toEqual(game);
    expect(result.current.player).toBeNull();
    expect(result.current.error).toBe("");
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("un GET no-ok (404) deja 'Failed to load game' y no setea game", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));

    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to load game");
    expect(result.current.game).toBeNull();
  });

  it("con sesión guardada re-emite join-game con playerId y avatar filtrado ['none']", async () => {
    setSession("p1", "Ana", "Felix", ["sunglasses", "none"]);
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );

    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.player?.id).toBe("p1");
    expect(mocks.emit).toHaveBeenCalledWith("join-game", {
      gameId: GAME_ID,
      playerId: "p1",
      avatar: { seed: "Felix", accessories: ["sunglasses"] },
    });
    // CARACTERIZACIÓN: el estado `avatar` conserva los accesorios SIN filtrar.
    expect(result.current.avatar).toEqual({
      seed: "Felix",
      accessories: ["sunglasses", "none"],
    });
  });

  it("con sesión sin seed, el re-join usa el nombre como seed y no persiste claves de avatar", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );

    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mocks.emit).toHaveBeenCalledWith("join-game", {
      gameId: GAME_ID,
      playerId: "p1",
      avatar: { seed: "Ana", accessories: [] },
    });
    expect(localStorage.getItem("playerAvatarSeed")).toBeNull();
    expect(localStorage.getItem("playerAvatarAccessories")).toBeNull();
  });

  it("con sesión sin playerName no re-emite join-game aunque haya playerId", async () => {
    localStorage.setItem("playerId", "p1");
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );

    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.player).toBeNull();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("si el jugador de la sesión ya no está en el game no re-emite join-game", async () => {
    setSession("p9", "Zoe");
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );

    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.player).toBeNull();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("joined setea player/game/avatar, guarda la sesión y apaga loading", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    const { result } = renderSession();

    const player = makePlayer("p9", {
      name: "Zoe",
      avatar: { seed: "Milo", accessories: ["hat"] },
    });
    const game = makeGame({ players: [player] });
    await trigger("joined", { player, game });

    expect(result.current.loading).toBe(false);
    expect(result.current.player).toEqual(player);
    expect(result.current.game).toEqual(game);
    expect(result.current.avatar).toEqual({ seed: "Milo", accessories: ["hat"] });
    expect(result.current.phase).toBe("waiting");
    expect(localStorage.getItem("playerId")).toBe("p9");
    expect(localStorage.getItem("playerName")).toBe("Zoe");
  });

  it("game-started fija phase question, resetea flags y calcula previousLeaderboard", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const q1 = makeQuestion({ id: "q1" });
    const q2 = makeQuestion({ id: "q2" });
    const game = makeGame({
      status: "active",
      questions: [q1, q2],
      players: [makePlayer("p1", { score: 50 }), makePlayer("p2", { score: 30 })],
    });

    await trigger("game-started", {
      game,
      players: game.players,
      currentQuestion: q1,
    });

    expect(result.current.game).toEqual(game);
    expect(result.current.phase).toBe("question");
    expect(result.current.isQuestionFinished).toBe(false);
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.playerAnswerResult).toBeNull();
    expect(result.current.player?.id).toBe("p1");
    expect(result.current.previousLeaderboard).toEqual([
      { playerId: "p1", score: 50 },
      { playerId: "p2", score: 30 },
    ]);
  });

  it("question-changed avanza el índice, vuelve a phase question y resetea hasSubmitted/resultado", async () => {
    setSession("p1", "Ana");
    const q1 = makeQuestion({ id: "q1" });
    const q2 = makeQuestion({ id: "q2" });
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: makeGame({
          status: "active",
          questions: [q1, q2],
          players: [
            makePlayer("p1", { answers: { q1: 3 }, score: 120 }),
            makePlayer("p2"),
          ],
          currentQuestionStartTime: Date.now() - 1000,
        }),
      })
    );
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phase).toBe("question");
    expect(result.current.hasSubmitted).toBe(true);

    await trigger("question-changed", {
      question: q2,
      questionIndex: 1,
      timeLeft: 30,
    });

    expect(result.current.phase).toBe("question");
    expect(result.current.isQuestionFinished).toBe(false);
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.playerAnswerResult).toBeNull();
    expect(result.current.game?.currentQuestionIndex).toBe(1);
  });

  it("game-updated con mi respuesta marca hasSubmitted", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({ game: activeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasSubmitted).toBe(false);

    const game = activeGame({
      players: [makePlayer("p1", { answers: { q1: 2 } }), makePlayer("p2")],
    });
    await trigger("game-updated", { game });

    expect(result.current.game).toEqual(game);
    expect(result.current.player?.answers).toEqual({ q1: 2 });
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.isQuestionFinished).toBe(false);
  });

  it("game-updated con todos respondidos marca isQuestionFinished y playerAnswerResult", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({ game: activeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const game = activeGame({
      players: [
        makePlayer("p1", { answers: { q1: 3 }, score: 120 }),
        makePlayer("p2", { answers: { q1: 0 } }),
      ],
    });
    await trigger("game-updated", { game });

    expect(result.current.isQuestionFinished).toBe(true);
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.playerAnswerResult).toEqual({
      correct: true,
      score: 120,
    });
  });

  it("game-state setea game/player y re-sincroniza la fase", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const q1 = makeQuestion({ id: "q1" });
    const game = activeGame({
      questions: [q1],
      players: [makePlayer("p1", { answers: { q1: 0 } }), makePlayer("p2")],
    });
    await trigger("game-state", {
      game,
      currentQuestion: q1,
      currentQuestionIndex: 0,
      timeLeft: 20,
    });

    expect(result.current.game).toEqual(game);
    expect(result.current.player?.id).toBe("p1");
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.phase).toBe("question");
  });

  it("question-finished pasa a showing-result y emite request-game-state", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({ game: activeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await trigger("question-finished", { currentQuestionIndex: 0 });

    expect(result.current.isQuestionFinished).toBe(true);
    expect(result.current.phase).toBe("showing-result");
    expect(mocks.emit).toHaveBeenCalledWith("request-game-state", {
      gameId: GAME_ID,
    });
  });

  it("join-error muestra el mensaje del payload o el fallback", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    renderSession();

    await trigger("join-error", { message: "Sala llena" });
    expect(sonnerMock.error).toHaveBeenCalledWith("Sala llena");

    await trigger("join-error", {});
    expect(sonnerMock.error).toHaveBeenCalledWith("Failed to join the game");
  });

  it("game-finished setea game y results", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const finishedGame = makeGame({ status: "finished" });
    const results = makeResults();
    await trigger("game-finished", { game: finishedGame, results });

    expect(result.current.game?.status).toBe("finished");
    expect(result.current.results).toEqual(results);
  });

  it("CARACTERIZACIÓN: game-finished sin game solo parchea el status en el game previo", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const results = makeResults();
    await trigger("game-finished", {
      game: undefined as unknown as Game,
      results,
    });

    expect(result.current.game?.id).toBe(GAME_ID);
    expect(result.current.game?.status).toBe("finished");
    expect(result.current.results).toEqual(results);
  });

  it("game-cancelled con game lo setea tal cual", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const cancelled = makeGame({ status: "cancelled" });
    await trigger("game-cancelled", { game: cancelled });

    expect(result.current.game).toEqual(cancelled);
  });

  it("CARACTERIZACIÓN: game-cancelled sin game solo parchea status cancelled (conserva el resto)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ game: makeGame({ players: [makePlayer("p1")] }) })
    );
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await trigger("game-cancelled", {});

    expect(result.current.game?.id).toBe(GAME_ID);
    expect(result.current.game?.status).toBe("cancelled");
    expect(result.current.game?.players).toHaveLength(1);
  });

  it("a los 4000 ms en showing-result pasa a showing-scoreboard (3999 no)", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({ game: activeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phase).toBe("question");

    vi.useFakeTimers();
    await trigger("question-finished", { currentQuestionIndex: 0 });
    expect(result.current.phase).toBe("showing-result");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3999);
    });
    expect(result.current.phase).toBe("showing-result");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.phase).toBe("showing-scoreboard");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("el timer de 4000 ms se limpia al desmontar sin disparar la transición", async () => {
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({ game: activeGame() }));
    const { result, unmount } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.useFakeTimers();
    await trigger("question-finished", { currentQuestionIndex: 0 });
    expect(result.current.phase).toBe("showing-result");
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("join trimea el nombre, guarda la sesión SIN filtrar y emite el avatar filtrado", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.actions.join({
        playerName: "  Carla  ",
        avatarSeed: "Felix",
        avatarAccessories: ["sunglasses", "none"],
      });
    });

    expect(mocks.emit).toHaveBeenCalledWith("join-game", {
      gameId: GAME_ID,
      playerName: "Carla",
      avatar: { seed: "Felix", accessories: ["sunglasses"] },
    });
    expect(localStorage.getItem("playerName")).toBe("Carla");
    expect(localStorage.getItem("playerAvatarSeed")).toBe("Felix");
    expect(localStorage.getItem("playerAvatarAccessories")).toBe(
      JSON.stringify(["sunglasses", "none"])
    );
  });

  it("join sin seed usa el nombre y no escribe claves de avatar", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ game: makeGame() }));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.actions.join({ playerName: "Ana" });
    });

    expect(mocks.emit).toHaveBeenCalledWith("join-game", {
      gameId: GAME_ID,
      playerName: "Ana",
      avatar: { seed: "Ana", accessories: [] },
    });
    expect(localStorage.getItem("playerAvatarSeed")).toBeNull();
    expect(localStorage.getItem("playerAvatarAccessories")).toBeNull();
  });

  it("submitAnswer emite el payload exacto y actualiza el estado optimista", async () => {
    setSession("p1", "Ana");
    const q1 = makeQuestion({ id: "q7", correctAnswer: 1 });
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: activeGame({
          questions: [q1],
          players: [makePlayer("p1", { score: 120 }), makePlayer("p2")],
        }),
      })
    );
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phase).toBe("question");

    act(() => {
      result.current.actions.submitAnswer(2);
    });

    expect(mocks.emit).toHaveBeenCalledWith("submit-answer", {
      gameId: GAME_ID,
      playerId: "p1",
      questionId: "q7",
      answer: 2,
    });
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.player?.answers).toEqual({ q7: 2 });
    expect(result.current.playerAnswerResult).toEqual({
      correct: false,
      score: 120,
    });
  });

  it("CARACTERIZACIÓN: submitAnswer sin player no emite (guard sin estado)", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    const { result } = renderSession();

    act(() => {
      result.current.actions.submitAnswer(1);
    });

    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("CARACTERIZACIÓN: el hook no guarda doble envío; una segunda llamada directa re-emite", async () => {
    setSession("p1", "Ana");
    const q1 = makeQuestion({ id: "q7", correctAnswer: 1 });
    fetchMock.mockResolvedValue(
      jsonResponse({
        game: activeGame({
          questions: [q1],
          players: [makePlayer("p1", { score: 120 }), makePlayer("p2")],
        }),
      })
    );
    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // La prevención del doble envío vive en la UI (AnswerPanel oculta la card
    // con `hasSubmitted`); el hook no tiene guard propio.
    act(() => {
      result.current.actions.submitAnswer(2);
    });
    act(() => {
      result.current.actions.submitAnswer(1);
    });

    const submitCalls = mocks.emit.mock.calls.filter(
      ([event]) => event === "submit-answer"
    );
    expect(submitCalls).toHaveLength(2);
    expect(result.current.playerAnswerResult).toEqual({
      correct: true,
      score: 120,
    });
  });

  it("regresión US-18: body 200 sin game no rompe el bootstrap (guard)", async () => {
    // El guard descarta el body y el flujo sigue por el camino feliz: no cae
    // en el catch (error vacío) ni intenta leer `game.players` con sesión activa.
    setSession("p1", "Ana");
    fetchMock.mockResolvedValue(jsonResponse({}));

    const { result } = renderSession();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.game).toBeNull();
    expect(result.current.error).toBe("");
    expect(mocks.emit).not.toHaveBeenCalled();
  });
});
