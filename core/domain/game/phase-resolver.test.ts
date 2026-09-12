/**
 * Tests de `resolveGamePhase` (US-14, R1-R19 del design note).
 *
 * Extraído de `syncPhaseFromGame` (`app/game/[gameId]/page.tsx`): aquí se fijan
 * los bordes de la máquina de fases inyectando `now`, sin DOM ni socket.
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../game";
import type { Player } from "../player";
import { resolveGamePhase } from "./phase-resolver";

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "p1",
  name: "Ana",
  gameId: "g1",
  answers: {},
  score: 0,
  joinedAt: new Date(0),
  ...overrides,
});

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: "g1",
  name: "Quiz",
  questions: [
    {
      id: "q1",
      text: "¿2+2?",
      options: ["1", "2", "3", "4"],
      correctAnswer: 2,
      image: null,
    },
  ],
  createdAt: new Date(0),
  creatorId: "c1",
  status: "active",
  currentQuestionIndex: 0,
  players: [makePlayer()],
  currentQuestionStartTime: 1000,
  questionTimeLimit: 30000,
  ...overrides,
});

describe("resolveGamePhase — máquina de fases del jugador", () => {
  it("R1: status 'waiting' devuelve null aunque haya respuesta y tiempo agotado", () => {
    const game = makeGame({
      status: "waiting",
      currentQuestionStartTime: 0,
      players: [makePlayer({ answers: { q1: 2 } })],
    });

    expect(resolveGamePhase(game, makePlayer({ answers: { q1: 2 } }), 999999)).toBeNull();
  });

  it("R2: status 'finished' devuelve null", () => {
    expect(
      resolveGamePhase(makeGame({ status: "finished" }), makePlayer(), 2000)
    ).toBeNull();
  });

  it("R3: status 'cancelled' devuelve null", () => {
    expect(
      resolveGamePhase(makeGame({ status: "cancelled" }), makePlayer(), 2000)
    ).toBeNull();
  });

  it("R4: currentQuestionIndex fuera de rango devuelve null", () => {
    expect(
      resolveGamePhase(makeGame({ currentQuestionIndex: 5 }), makePlayer(), 2000)
    ).toBeNull();
  });

  it("R5: active sin responder y tiempo vigente ⇒ fase 'question'", () => {
    expect(resolveGamePhase(makeGame(), makePlayer(), 2000)).toEqual({
      phase: "question",
      hasSubmitted: false,
      questionFinished: false,
      answerResult: null,
    });
  });

  it("R6: answers {q1: 0} cuenta como respondida (quirk !== undefined)", () => {
    const resolution = resolveGamePhase(
      makeGame(),
      makePlayer({ answers: { q1: 0 } }),
      2000
    );

    expect(resolution?.hasSubmitted).toBe(true);
  });

  it("R7: respuesta correcta con score 120 ⇒ answerResult {correct:true,score:120}", () => {
    const resolution = resolveGamePhase(
      makeGame(),
      makePlayer({ answers: { q1: 2 }, score: 120 }),
      2000
    );

    expect(resolution?.answerResult).toEqual({ correct: true, score: 120 });
  });

  it("R8: respuesta incorrecta con score 0 ⇒ answerResult {correct:false,score:0}", () => {
    const resolution = resolveGamePhase(
      makeGame(),
      makePlayer({ answers: { q1: 0 }, score: 0 }),
      2000
    );

    expect(resolution?.answerResult).toEqual({ correct: false, score: 0 });
  });

  it("R9: me null ⇒ hasSubmitted false y answerResult null", () => {
    const resolution = resolveGamePhase(makeGame(), null, 2000);

    expect(resolution?.hasSubmitted).toBe(false);
    expect(resolution?.answerResult).toBeNull();
  });

  it("R10: players [] sin expirar ⇒ questionFinished false (guarda length > 0)", () => {
    const resolution = resolveGamePhase(
      makeGame({ players: [] }),
      makePlayer(),
      2000
    );

    expect(resolution?.questionFinished).toBe(false);
    expect(resolution?.phase).toBe("question");
  });

  it("R11: 2/2 jugadores respondieron ⇒ 'showing-result' con answerResult propio", () => {
    const me = makePlayer({ answers: { q1: 2 }, score: 80 });
    const other = makePlayer({ id: "p2", name: "Beto", answers: { q1: 0 } });
    const resolution = resolveGamePhase(
      makeGame({ players: [me, other] }),
      me,
      2000
    );

    expect(resolution?.phase).toBe("showing-result");
    expect(resolution?.answerResult).toEqual({ correct: true, score: 80 });
  });

  it("R12: currentQuestionStartTime 0 ⇒ 'showing-result' (timeExpired)", () => {
    const resolution = resolveGamePhase(
      makeGame({ currentQuestionStartTime: 0 }),
      makePlayer(),
      1
    );

    expect(resolution?.phase).toBe("showing-result");
    expect(resolution?.questionFinished).toBe(true);
  });

  it("R13: frontera exacta now === start + limit ⇒ 'showing-result' (>=)", () => {
    const resolution = resolveGamePhase(
      makeGame({ currentQuestionStartTime: 1000, questionTimeLimit: 30000 }),
      makePlayer(),
      31000
    );

    expect(resolution?.phase).toBe("showing-result");
  });

  it("R14: now === start + limit - 1 ⇒ 'question'", () => {
    const resolution = resolveGamePhase(
      makeGame({ currentQuestionStartTime: 1000, questionTimeLimit: 30000 }),
      makePlayer(),
      30999
    );

    expect(resolution?.phase).toBe("question");
    expect(resolution?.questionFinished).toBe(false);
  });

  it("R15: questionTimeLimit 0 ⇒ default 30000 (expira exactamente a 31000)", () => {
    const game = makeGame({
      currentQuestionStartTime: 1000,
      questionTimeLimit: 0,
    });

    expect(resolveGamePhase(game, makePlayer(), 30999)?.phase).toBe("question");
    expect(resolveGamePhase(game, makePlayer(), 31000)?.phase).toBe(
      "showing-result"
    );
  });

  it("R16: questionTimeLimit ausente, now - start = 29000 ⇒ 'question'", () => {
    const resolution = resolveGamePhase(
      makeGame({ currentQuestionStartTime: 1000, questionTimeLimit: undefined }),
      makePlayer(),
      30000
    );

    expect(resolution?.phase).toBe("question");
  });

  it("R17: questionTimeLimit ausente, now - start = 31000 ⇒ 'showing-result'", () => {
    const resolution = resolveGamePhase(
      makeGame({ currentQuestionStartTime: 1000, questionTimeLimit: undefined }),
      makePlayer(),
      32000
    );

    expect(resolution?.phase).toBe("showing-result");
  });

  it("R18: respondió y expiró ⇒ 'showing-result' conservando answerResult", () => {
    const me = makePlayer({ answers: { q1: 2 }, score: 500 });
    const resolution = resolveGamePhase(
      makeGame({ currentQuestionStartTime: 1000, questionTimeLimit: 20000 }),
      me,
      22000
    );

    expect(resolution?.phase).toBe("showing-result");
    expect(resolution?.answerResult).toEqual({ correct: true, score: 500 });
  });

  it("R19: no respondió, expiró y me presente ⇒ 'showing-result' sin answerResult", () => {
    const resolution = resolveGamePhase(
      makeGame({ currentQuestionStartTime: 1000, questionTimeLimit: 20000 }),
      makePlayer(),
      22000
    );

    expect(resolution?.phase).toBe("showing-result");
    expect(resolution?.answerResult).toBeNull();
  });
});
