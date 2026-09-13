/**
 * CARACTERIZACIÓN US-21 (H2) — `components/game/AnswerPanel.tsx`.
 *
 * Actualizado intencionalmente en US-21 (H2): se eliminó la confirmación
 * transitoria con check (✅) y ahora, apenas `hasSubmitted` es true, se muestra
 * directamente el mensaje de espera.
 *
 * Además se congeló la corrección de review de US-21: la espera se muestra
 * SIEMPRE que `hasSubmitted`, incluso cuando `isQuestionFinished` ya es true
 * (el hook marca `allAnswered` un tick antes de pasar a `showing-result`). El
 * `null` queda solo para quien no envió y la pregunta terminó o no existe.
 *
 * `QuestionCard` se mockea para aislar el panel; su propio comportamiento se
 * caracteriza en `components/QuestionCard.test.tsx`.
 *
 * NOTA DE ENTORNO: ver `JoinForm.test.tsx` (`oxc.jsx` en `vitest.config.ts`).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/types";

const mocks = vi.hoisted(() => ({ submit: vi.fn() }));

vi.mock("@/components/QuestionCard", () => ({
  QuestionCard: ({
    question,
    onAnswerSubmit,
  }: {
    question: Question;
    onAnswerSubmit: (answerIndex: number) => void;
  }) => (
    <button type="button" onClick={() => onAnswerSubmit(0)}>
      stub-question-card: {question.text}
    </button>
  ),
}));

import { AnswerPanel } from "@/components/game/AnswerPanel";

const QUESTION: Question = {
  id: "q1",
  text: "¿2+2?",
  options: ["1", "2", "3", "4"],
  correctAnswer: 3,
  image: null,
};

beforeEach(() => {
  mocks.submit.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AnswerPanel (caracterización US-21 H2)", () => {
  it("con hasSubmitted y pregunta sin terminar muestra la espera directa sin check (H2)", () => {
    render(
      <AnswerPanel
        question={QUESTION}
        hasSubmitted
        isQuestionFinished={false}
        onAnswerSubmit={mocks.submit}
      />
    );

    expect(
      screen.getByText("Esperando respuestas de los demás jugadores…")
    ).toBeTruthy();
    expect(screen.queryByText("¡Respuesta enviada!")).toBeNull();
    expect(screen.queryByText("✅")).toBeNull();
    expect(screen.queryByText(/stub-question-card/)).toBeNull();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("con hasSubmitted y pregunta terminada sigue mostrando la espera (regresión: evita el blanco antes de ResultPanel)", () => {
    render(
      <AnswerPanel
        question={QUESTION}
        hasSubmitted
        isQuestionFinished
        onAnswerSubmit={mocks.submit}
      />
    );

    expect(
      screen.getByText("Esperando respuestas de los demás jugadores…")
    ).toBeTruthy();
    expect(screen.queryByText(/stub-question-card/)).toBeNull();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("con isQuestionFinished y sin result devuelve null", () => {
    const { container } = render(
      <AnswerPanel
        question={QUESTION}
        hasSubmitted={false}
        isQuestionFinished
        onAnswerSubmit={mocks.submit}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("sin pregunta devuelve null", () => {
    const { container } = render(
      <AnswerPanel
        question={null}
        hasSubmitted={false}
        isQuestionFinished={false}
        onAnswerSubmit={mocks.submit}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("en juego normal renderiza QuestionCard y reenvía onAnswerSubmit", () => {
    render(
      <AnswerPanel
        question={QUESTION}
        hasSubmitted={false}
        isQuestionFinished={false}
        onAnswerSubmit={mocks.submit}
      />
    );

    const card = screen.getByRole("button", {
      name: "stub-question-card: ¿2+2?",
    });
    fireEvent.click(card);

    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.submit).toHaveBeenCalledWith(0);
  });
});
