/**
 * CARACTERIZACIÓN US-21 (H2/H3) — `components/QuestionCard.tsx`.
 *
 * Actualizado intencionalmente en US-21. Congela el comportamiento nuevo:
 * - la pregunta y sus 4 opciones,
 * - que un click responde UNA sola vez y el segundo no reenvía,
 * - la grilla 2×2 también en mobile (`grid-cols-2`, sin `grid-cols-1`) — H3,
 * - que el submit dejó de ser async y ya NO existen el texto
 *   "Sending your answer..." ni el overlay de check (fondo blanco circular con
 *   el check SVG) — H2.
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
    const { container } = render(
      <QuestionCard question={question} onAnswerSubmit={vi.fn()} />
    );
    fireEvent.click(optionButtons()[0]);

    expect(screen.queryByText("Sending your answer...")).toBeNull();
    // El overlay de check (contenedor blanco circular + check SVG) ya no existe.
    expect(container.querySelector("div.bg-white.rounded-full")).toBeNull();
    expect(
      container.querySelector('svg path[d="M5 13l4 4L19 7"]')
    ).toBeNull();
  });
});
