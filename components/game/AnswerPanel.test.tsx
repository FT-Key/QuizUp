/**
 * CARACTERIZACIÓN US-21 (H2) — `components/game/AnswerPanel.tsx`.
 *
 * Congela el comportamiento ACTUAL previo a H2: al enviar la respuesta se
 * muestra una confirmación transitoria con check (✅) y el texto
 * "¡Respuesta enviada! / Esperando a los demás jugadores...". US-21 eliminará
 * el check y mostrará directamente el mensaje de espera.
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

  it("con hasSubmitted y pregunta terminada devuelve null (la página muestra ResultPanel)", () => {
    const { container } = render(
      <AnswerPanel
        question={QUESTION}
        hasSubmitted
        isQuestionFinished
        onAnswerSubmit={mocks.submit}
      />
    );

    expect(container.firstChild).toBeNull();
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
