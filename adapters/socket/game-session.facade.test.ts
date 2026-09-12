import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  asRealtimeClient,
  createFakeSocket,
  type FakeSocket,
} from "@/tests/fakes/socket";
import { createMemorySession } from "@/adapters/session/local-storage-session";
import { createFixedRetryPolicy } from "@/core/application/ports/retry-policy";
import type { PlayerSession } from "@/core/application/ports/player-session";
import type { RetryPolicy } from "@/core/application/ports/retry-policy";
import type { Game } from "@/types";
import { createSocketEventBus } from "./socket-event-bus";
import {
  createGameSessionFacade,
  createHttpGameFetcher,
  type GameSessionFacade,
} from "./game-session.facade";

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: "g1",
  name: "Quiz",
  questions: [],
  createdAt: new Date(0),
  creatorId: "c1",
  status: "waiting",
  currentQuestionIndex: 0,
  players: [],
  currentQuestionStartTime: 0,
  questionTimeLimit: 30000,
  ...overrides,
});

interface FacadeHarness {
  fake: FakeSocket;
  session: PlayerSession;
  fetchGame: ReturnType<typeof vi.fn<(gameId: string) => Promise<Game | null>>>;
  facade: GameSessionFacade;
}

function createFacade(options: { retryPolicy?: RetryPolicy } = {}): FacadeHarness {
  const fake = createFakeSocket();
  const session = createMemorySession();
  const fetchGame = vi.fn<(gameId: string) => Promise<Game | null>>(
    async () => null
  );
  const realtime = asRealtimeClient(fake);
  const bus = createSocketEventBus(realtime);
  const facade = createGameSessionFacade({
    realtime,
    bus,
    session,
    retryPolicy:
      options.retryPolicy ??
      createFixedRetryPolicy({ maxRetries: 5, delayMs: 3000 }),
    fetchGame,
  });

  return { fake, session, fetchGame, facade };
}

describe("GameSessionFacade.join (jugador)", () => {
  it("con sesión emite join-game con playerId, nombre y avatar de la sesión", () => {
    const { fake, session, facade } = createFacade();
    session.set("playerId", "p1");
    session.set("playerName", "Ana");
    session.set("playerAvatarSeed", "Felix");
    session.setAccessories(["hat", "glasses"]);

    facade.join({ gameId: "g1" });

    expect(fake.emittedFor("join-game")).toEqual([
      {
        event: "join-game",
        args: [
          {
            gameId: "g1",
            playerId: "p1",
            playerName: "Ana",
            avatar: { seed: "Felix", accessories: ["hat", "glasses"] },
          },
        ],
      },
    ]);
  });

  it("sin sesión usa playerId null y siembra el avatar con el nombre", () => {
    const { fake, facade } = createFacade();

    facade.join({ gameId: "g1", playerName: "Prop" });

    expect(fake.emittedFor("join-game")).toEqual([
      {
        event: "join-game",
        args: [
          {
            gameId: "g1",
            playerId: null,
            playerName: "Prop",
            avatar: { seed: "Prop", accessories: [] },
          },
        ],
      },
    ]);
  });

  it("playerName prop tiene prioridad sobre la sesión (y también siembra el avatar)", () => {
    const { fake, session, facade } = createFacade();
    session.set("playerName", "Guardado");
    session.set("playerId", "p1");

    facade.join({ gameId: "g1", playerName: "Prop" });

    expect(fake.emittedFor("join-game")).toEqual([
      {
        event: "join-game",
        args: [
          {
            gameId: "g1",
            playerId: "p1",
            playerName: "Prop",
            avatar: { seed: "Prop", accessories: [] },
          },
        ],
      },
    ]);
  });

  it("sin nombre (prop ni sesión) no emite nada", () => {
    const { fake, facade } = createFacade();

    facade.join({ gameId: "g1" });

    expect(fake.emitted).toHaveLength(0);
  });

  it("admin emite join-admin con el gameId y no lee la sesión", () => {
    const { fake, session, facade } = createFacade();
    session.set("playerName", "Ana");
    session.set("playerId", "p1");
    const getSpy = vi.spyOn(session, "get");
    const getAccessoriesSpy = vi.spyOn(session, "getAccessories");

    facade.join({ gameId: "g1", isAdmin: true });

    expect(fake.emittedFor("join-admin")).toEqual([
      { event: "join-admin", args: ["g1"] },
    ]);
    expect(fake.emittedFor("join-game")).toHaveLength(0);
    expect(getSpy).not.toHaveBeenCalled();
    expect(getAccessoriesSpy).not.toHaveBeenCalled();
  });
});

describe("GameSessionFacade comandos", () => {
  it("emite cada comando con el payload exacto del contrato", () => {
    const { fake, facade } = createFacade();
    const answer = {
      gameId: "g1",
      playerId: "p1",
      questionId: "q1",
      answer: 2,
    };

    facade.submitAnswer(answer);
    facade.requestGameState("g1");
    facade.lockGame("g1", true);
    facade.closeGame("g1");
    facade.leaveGame("g1", "p1");

    expect(fake.emitted).toEqual([
      { event: "submit-answer", args: [answer] },
      { event: "request-game-state", args: [{ gameId: "g1" }] },
      { event: "lock-game", args: [{ gameId: "g1", locked: true }] },
      { event: "close-game", args: [{ gameId: "g1" }] },
      { event: "leave-game", args: [{ gameId: "g1", playerId: "p1" }] },
    ]);
  });

  it("emit delega el evento y el payload dinámicos", () => {
    const { fake, facade } = createFacade();

    facade.emit("start-game", { gameId: "g1" });
    facade.emit("request-dashboard");

    expect(fake.emitted).toEqual([
      { event: "start-game", args: [{ gameId: "g1" }] },
      { event: "request-dashboard", args: [] },
    ]);
  });
});

describe("GameSessionFacade observer", () => {
  it("on suscribe en el realtime y devuelve la baja", () => {
    const { fake, facade } = createFacade();
    const handler = vi.fn();

    const unsubscribe = facade.on("joined", handler);

    expect(fake.listenerCount("joined")).toBe(1);

    fake.trigger("joined", { playerId: "p1" });

    expect(handler).toHaveBeenCalledWith({ playerId: "p1" });

    unsubscribe();

    expect(fake.listenerCount("joined")).toBe(0);
  });

  it("onConnect/onDisconnect siguen connect/disconnect y `connected` refleja el realtime", () => {
    const { fake, facade } = createFacade();
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    facade.onConnect(onConnect);
    facade.onDisconnect(onDisconnect);

    expect(facade.connected).toBe(false);

    fake.setConnected(true);

    expect(facade.connected).toBe(true);
    expect(onConnect).toHaveBeenCalledTimes(1);

    fake.setConnected(false);

    expect(facade.connected).toBe(false);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("las bajas de onConnect/onDisconnect desregistran", () => {
    const { fake, facade } = createFacade();
    const onConnect = vi.fn();

    const offConnect = facade.onConnect(onConnect);

    offConnect();
    fake.setConnected(true);

    expect(fake.listenerCount("connect")).toBe(0);
    expect(onConnect).not.toHaveBeenCalled();
  });
});

describe("GameSessionFacade.scheduleGameStateRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emite request-game-state 5 veces cada 3000 ms y agota UNA vez en el 5.º tick", () => {
    const { fake, facade } = createFacade();
    fake.connected = true;
    const onExhausted = vi.fn();

    const cancel = facade.scheduleGameStateRetry("g1", { onExhausted });

    expect(fake.emittedFor("request-game-state")).toHaveLength(0);

    for (let tick = 1; tick <= 5; tick += 1) {
      vi.advanceTimersByTime(3000);

      expect(fake.emittedFor("request-game-state")).toHaveLength(tick);
      expect(onExhausted).toHaveBeenCalledTimes(tick === 5 ? 1 : 0);
    }

    expect(fake.emittedFor("request-game-state")[0].args).toEqual([
      { gameId: "g1" },
    ]);

    vi.advanceTimersByTime(30_000);

    expect(fake.emittedFor("request-game-state")).toHaveLength(5);
    expect(onExhausted).toHaveBeenCalledTimes(1);

    cancel();
  });

  it("la cancelación limpia el timer pendiente y evita el agotamiento", () => {
    const { fake, facade } = createFacade();
    fake.connected = true;
    const onExhausted = vi.fn();

    const cancel = facade.scheduleGameStateRetry("g1", { onExhausted });

    vi.advanceTimersByTime(3000);
    expect(fake.emittedFor("request-game-state")).toHaveLength(1);

    cancel();
    vi.advanceTimersByTime(30_000);

    expect(fake.emittedFor("request-game-state")).toHaveLength(1);
    expect(onExhausted).not.toHaveBeenCalled();
  });

  it("sin conexión avanza el plan igual (no emite) y agota al final", () => {
    const { fake, facade } = createFacade();
    const onExhausted = vi.fn();

    facade.scheduleGameStateRetry("g1", { onExhausted });

    vi.advanceTimersByTime(15_000);

    expect(fake.emittedFor("request-game-state")).toHaveLength(0);
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it("con el plan agotado de entrada llama onExhausted de inmediato sin programar timers", () => {
    const { fake, facade } = createFacade({
      retryPolicy: { nextDelayMs: () => null },
    });
    const onExhausted = vi.fn();

    const cancel = facade.scheduleGameStateRetry("g1", { onExhausted });

    expect(onExhausted).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);

    expect(fake.emitted).toHaveLength(0);
    expect(onExhausted).toHaveBeenCalledTimes(1);

    cancel();
  });
});

describe("GameSessionFacade.fetchGameState", () => {
  it("propaga el gameId y devuelve el resultado del fetcher inyectado", async () => {
    const { fetchGame, facade } = createFacade();
    const game = makeGame();
    fetchGame.mockResolvedValueOnce(game);

    await expect(facade.fetchGameState("g1")).resolves.toBe(game);
    expect(fetchGame).toHaveBeenCalledWith("g1");
  });
});

describe("createHttpGameFetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const jsonResponse = (body: unknown, ok = true): Response =>
    ({ ok, json: async () => body }) as unknown as Response;

  it("respuesta ok con game devuelve el game y llama a GET /api/games/:id", async () => {
    const game = makeGame();
    const fetchMock = vi.fn(async () => jsonResponse({ game }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createHttpGameFetcher()("g1")).resolves.toBe(game);
    expect(fetchMock).toHaveBeenCalledWith("/api/games/g1");
  });

  it("respuesta no-ok devuelve null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ game: makeGame() }, false))
    );

    await expect(createHttpGameFetcher()("g1")).resolves.toBeNull();
  });

  it("JSON sin game devuelve null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));

    await expect(createHttpGameFetcher()("g1")).resolves.toBeNull();
  });

  it("error de red o de parseo devuelve null sin lanzar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await expect(createHttpGameFetcher()("g1")).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => {
              throw new Error("bad json");
            },
          }) as unknown as Response
      )
    );

    await expect(createHttpGameFetcher()("g1")).resolves.toBeNull();
  });
});
