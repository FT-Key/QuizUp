/**
 * CARACTERIZACIÓN US-21 (H2/H3) — `components/QuestionCard.tsx`.
 *
 * Congela:
 * - la pregunta y sus 4 opciones,
 * - que un click responde UNA sola vez y el segundo no reenvía,
 * - la grilla `grid-cols-1 sm:grid-cols-2` (1 columna en mobile) — H3 la
 *   pasará a 2×2 también en mobile,
 * - el texto "Sending your answer..." mientras el submit está pendiente — H2
 *   lo quitará junto con el overlay de check.
 *
 * NOTA DE ENTORNO: ver `JoinForm.test.tsx` (`oxc.jsx` en `vitest.config.ts`).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionCard } from "@/components/QuestionCard";
import type { Question } from "@/types";

const OPTIONS = ["Uno", "Dos", "Tres", "Cuatro"] as const;

const question: Question = {
  id: "q1",
  text: "¿Cuántos lados tiene un cuadrado?",
  options: [...OPTIONS],
  correctAnswer: 3,
  image: null,
};

const optionButtons = () =>
  screen.getAllByRole("button") as HTMLButtonElement[];

afterEach(() => {
  cleanup();
});

describe("QuestionCard (caracterización US-21 H2/H3)", () => {
  it("renderiza el texto de la pregunta y las 4 opciones", () => {
    render(<QuestionCard question={question} onAnswerSubmit={vi.fn()} />);

    expect(screen.getByText(question.text)).toBeTruthy();
    for (const option of OPTIONS) {
      expect(screen.getByText(option)).toBeTruthy();
    }
    expect(optionButtons()).toHaveLength(4);
  });

  it("la grilla es 2×2 también en mobile (H3)", () => {
    const { container } = render(
      <QuestionCard question={question} onAnswerSubmit={vi.fn()} />
    );

    const grid = container.querySelector("div.grid");
    expect(grid).toBeTruthy();
    expect(grid?.className).toContain("grid-cols-2");
    // Ya no hay 1 columna en mobile.
    expect(grid?.className).not.toContain("grid-cols-1");
  });

  it("un click llama onAnswerSubmit(index) una sola vez; el segundo click no reenvía", () => {
    const onAnswerSubmit = vi.fn();
    render(<QuestionCard question={question} onAnswerSubmit={onAnswerSubmit} />);

    const buttons = optionButtons();
    fireEvent.click(buttons[1]);

    expect(onAnswerSubmit).toHaveBeenCalledTimes(1);
    expect(onAnswerSubmit).toHaveBeenCalledWith(1);

    fireEvent.click(buttons[3]);
    expect(onAnswerSubmit).toHaveBeenCalledTimes(1);
    // Tras el click las 4 opciones quedan deshabilitadas (anti reenvío).
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it("no muestra overlay de check ni 'Sending your answer...' (H2)", () => {
    render(<QuestionCard question={question} onAnswerSubmit={vi.fn()} />);
    fireEvent.click(optionButtons()[0]);

    expect(screen.queryByText("Sending your answer...")).toBeNull();
  });
});
