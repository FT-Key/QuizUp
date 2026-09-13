/**
 * CARACTERIZACIÓN US-21 (H5) — `components/game-form/QuestionEditor.tsx`.
 *
 * Congela el editor ACTUAL: header "Question N", textarea, 4 inputs de opciones
 * (Red/Blue/Green/Yellow), botón de marcar correcta, botón de eliminar solo con
 * `canRemove`, y el resumen "Correct answer: <color>". Los callbacks reciben los
 * argumentos correctos.
 *
 * US-21 (H5) agregará un acordeón (contenido plegable): hoy todo el contenido de
 * cualquier pregunta se renderiza expandido sin interacción.
 *
 * `ImagePicker` (Radix Dialog cerrado) se renderiza real y no fetchea al montar.
 *
 * NOTA DE ENTORNO: ver `JoinForm.test.tsx` (`oxc.jsx` en `vitest.config.ts`).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionEditor } from "@/components/game-form/QuestionEditor";
import type { QuizDraftQuestion } from "@/core/application/builders/quiz-builder";

const makeQuestion = (
  overrides: Partial<QuizDraftQuestion> = {}
): QuizDraftQuestion => ({
  text: "¿2+2?",
  options: ["1", "2", "3", "4"],
  correctAnswer: 0,
  image: null,
  ...overrides,
});

const setup = (
  props: {
    index?: number;
    question?: QuizDraftQuestion;
    canRemove?: boolean;
    isOpen?: boolean;
  } = {}
) => {
  const onRemove = vi.fn();
  const onToggle = vi.fn();
  const onTextChange = vi.fn();
  const onOptionChange = vi.fn();
  const onCorrectAnswerChange = vi.fn();
  const onImageChange = vi.fn();

  const utils = render(
    <QuestionEditor
      index={props.index ?? 0}
      question={props.question ?? makeQuestion()}
      canRemove={props.canRemove ?? false}
      isOpen={props.isOpen ?? true}
      onToggle={onToggle}
      onRemove={onRemove}
      onTextChange={onTextChange}
      onOptionChange={onOptionChange}
      onCorrectAnswerChange={onCorrectAnswerChange}
      onImageChange={onImageChange}
    />
  );

  return {
    ...utils,
    onRemove,
    onToggle,
    onTextChange,
    onOptionChange,
    onCorrectAnswerChange,
    onImageChange,
  };
};

afterEach(() => {
  cleanup();
});

describe("QuestionEditor (caracterización US-21 H5)", () => {
  it("renderiza Question N, textarea y 4 opciones", () => {
    setup({ index: 1 });

    expect(screen.getByText("Question 2")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Type your question here...")
    ).toBeTruthy();
    for (const placeholder of ["Red", "Blue", "Green", "Yellow"]) {
      expect(screen.getByPlaceholderText(placeholder)).toBeTruthy();
    }
    expect(screen.getByText("Answer Options")).toBeTruthy();
    expect(screen.getByText(/Correct answer:/)).toBeTruthy();
  });

  it("onTextChange recibe el nuevo texto", () => {
    const { onTextChange } = setup();

    fireEvent.change(screen.getByPlaceholderText("Type your question here..."), {
      target: { value: "Nueva pregunta" },
    });

    expect(onTextChange).toHaveBeenCalledTimes(1);
    expect(onTextChange).toHaveBeenCalledWith("Nueva pregunta");
  });

  it("onOptionChange recibe (índice de opción, valor)", () => {
    const { onOptionChange } = setup();

    fireEvent.change(screen.getByPlaceholderText("Blue"), {
      target: { value: "dos" },
    });

    expect(onOptionChange).toHaveBeenCalledTimes(1);
    expect(onOptionChange).toHaveBeenCalledWith(1, "dos");
  });

  it("onCorrectAnswerChange recibe el índice de la opción marcada", () => {
    const { onCorrectAnswerChange } = setup();

    const marks = screen.getAllByTitle("Mark as correct answer");
    expect(marks).toHaveLength(4);

    fireEvent.click(marks[2]);
    expect(onCorrectAnswerChange).toHaveBeenCalledTimes(1);
    expect(onCorrectAnswerChange).toHaveBeenCalledWith(2);
  });

  it("solo muestra el botón de eliminar cuando canRemove", () => {
    const withoutRemove = setup({ canRemove: false });
    expect(withoutRemove.container.querySelector("svg.lucide-trash2")).toBeNull();
    withoutRemove.unmount();

    const withRemove = setup({ canRemove: true });
    const trash = withRemove.container.querySelector("svg.lucide-trash2");
    expect(trash).toBeTruthy();

    fireEvent.click(trash?.closest("button") as HTMLButtonElement);
    expect(withRemove.onRemove).toHaveBeenCalledTimes(1);
  });

  it("isOpen=true renderiza el contenido del panel y aria-expanded=true (H5)", () => {
    setup({ index: 4, question: makeQuestion({ text: "P5" }), isOpen: true });

    expect(screen.getByText("Question 5")).toBeTruthy();
    expect(screen.getByDisplayValue("P5")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Type your question here...")
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Question 5/ }).getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("isOpen=false oculta el contenido, marca aria-expanded=false y el header llama onToggle (H5)", () => {
    const { onToggle } = setup({
      index: 1,
      question: makeQuestion({ text: "P2" }),
      isOpen: false,
    });

    expect(screen.getByText("Question 2")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Type your question here...")).toBeNull();
    expect(screen.queryByPlaceholderText("Red")).toBeNull();
    expect(screen.queryByText("Answer Options")).toBeNull();

    const header = screen.getByRole("button", { name: /Question 2/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(header);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
