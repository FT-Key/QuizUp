/**
 * CARACTERIZACIÓN US-17 (BL-11) — colores de opciones duplicados.
 *
 * Congela los valores observables de las 4 listas antes de centralizarlas:
 * `KAHOOT_COLORS` (QuestionCard/QuestionEditor) y las variantes
 * `OPTION_STYLES` (AdminPresentation) y `OPTION_COLORS` (AnswerChart), con el
 * orden invertido 2↔3 entre ambos pares. Recharts se mockea para capturar las
 * celdas sin ResizeObserver; el resto es render real en jsdom. Nada de red.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionCard } from "@/components/QuestionCard";
import { QuestionEditor } from "@/components/game-form/QuestionEditor";
import { AdminPresentation } from "@/components/admin/AdminPresentation";
import { AnswerChart } from "@/components/admin/AnswerChart";
import type { Game, Question } from "@/types";
import type { QuizDraftQuestion } from "@/core/application/builders/quiz-builder";

const rechartsMock = vi.hoisted(() => ({
  cells: [] as Array<{ fill?: string; fillOpacity?: number }>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Bar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  LabelList: () => null,
  Cell: (props: { fill?: string; fillOpacity?: number }) => {
    rechartsMock.cells.push(props);
    return null;
  },
}));

/** Hex del código actual (así los reciben los props de recharts). */
const HEX = {
  red: "#E21B3C",
  blue: "#1368CE",
  yellow: "#FFC900",
  green: "#26890C",
  gray: "#9CA3AF", // fallback explicito de AnswerChart
} as const;

/** Valores serializados por jsdom para esos hex en estilos inline. */
const RGB = {
  red: "rgb(226, 27, 60)",
  blue: "rgb(19, 104, 206)",
  yellow: "rgb(255, 201, 0)",
  green: "rgb(38, 137, 12)",
} as const;

const makeQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: "q1",
  text: "¿2+2?",
  options: ["A", "B", "C", "D"],
  correctAnswer: 0,
  image: null,
  ...overrides,
});

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: "123456",
  name: "Trivia de prueba",
  questions: [makeQuestion()],
  createdAt: new Date(0),
  creatorId: "admin",
  status: "active",
  currentQuestionIndex: 0,
  players: [],
  currentQuestionStartTime: 0,
  questionTimeLimit: 30000,
  ...overrides,
});

beforeEach(() => {
  rechartsMock.cells.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BL-11: QuestionCard (jugador) — orden Red, Blue, Green, Yellow", () => {
  it("pinta los 4 botones con bg e icono en orden", () => {
    render(<QuestionCard question={makeQuestion()} onAnswerSubmit={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.style.backgroundColor)).toEqual([
      RGB.red,
      RGB.blue,
      RGB.green,
      RGB.yellow,
    ]);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "▲A",
      "◆B",
      "●C",
      "■D",
    ]);
  });
});

describe("BL-11: QuestionEditor (creador) — mismo orden que QuestionCard", () => {
  it("colorea cada opción y mantiene el placeholder con el nombre del color", () => {
    const question: QuizDraftQuestion = {
      text: "¿2+2?",
      options: ["A", "B", "C", "D"],
      correctAnswer: 2,
      image: null,
    };

    render(
      <QuestionEditor
        index={0}
        question={question}
        canRemove={false}
        onRemove={vi.fn()}
        onTextChange={vi.fn()}
        onOptionChange={vi.fn()}
        onCorrectAnswerChange={vi.fn()}
        onImageChange={vi.fn()}
      />
    );

    const wrappers = ["Red", "Blue", "Green", "Yellow"].map(
      (name) =>
        screen.getByPlaceholderText(name).closest("div[style]") as HTMLElement
    );

    expect(wrappers.map((wrapper) => wrapper.style.backgroundColor)).toEqual([
      RGB.red,
      RGB.blue,
      RGB.green,
      RGB.yellow,
    ]);
  });
});

describe("BL-11: AdminPresentation — orden Red, Blue, Yellow, Green (2↔3)", () => {
  it("colorea las opciones con Yellow en el índice 2 y Green en el 3", () => {
    render(
      <AdminPresentation
        game={makeGame()}
        timeLeft={15000}
        questionEnded={false}
        isFinishing={false}
        onForceEnd={vi.fn()}
        onNextQuestion={vi.fn()}
        onFinish={vi.fn()}
      />
    );

    const rows = ["A", "B", "C", "D"].map(
      (option) => screen.getByText(option).closest("div[style]") as HTMLElement
    );

    expect(rows.map((row) => row.style.backgroundColor)).toEqual([
      RGB.red,
      RGB.blue,
      RGB.yellow,
      RGB.green,
    ]);
    expect(rows.map((row) => row.textContent)).toEqual([
      "▲A",
      "◆B",
      "●C",
      "■D",
    ]);
  });
});

describe("BL-11: AnswerChart — mismo orden que AdminPresentation + fallback gris", () => {
  it("colorea las 4 celdas en orden Red, Blue, Yellow, Green", () => {
    const { container } = render(
      <AnswerChart
        options={["A", "B", "C", "D"]}
        counts={[1, 2, 3, 4]}
        correctIndex={0}
      />
    );

    expect(rechartsMock.cells.map((cell) => cell.fill)).toEqual([
      HEX.red,
      HEX.blue,
      HEX.yellow,
      HEX.green,
    ]);
    expect(rechartsMock.cells.map((cell) => cell.fillOpacity)).toEqual([
      1, 0.55, 0.55, 0.55,
    ]);

    // Leyenda real en DOM: mismos colores, ya normalizados por jsdom.
    const dots = Array.from(container.querySelectorAll("span[style]"));
    expect(dots.map((dot) => (dot as HTMLElement).style.backgroundColor)).toEqual([
      RGB.red,
      RGB.blue,
      RGB.yellow,
      RGB.green,
    ]);
  });

  it("CARACTERIZACIÓN: una quinta opción usa el fallback gris #9CA3AF", () => {
    render(
      <AnswerChart
        options={["A", "B", "C", "D", "E"]}
        counts={[1, 1, 1, 1, 1]}
        correctIndex={0}
      />
    );

    expect(rechartsMock.cells.map((cell) => cell.fill)).toEqual([
      HEX.red,
      HEX.blue,
      HEX.yellow,
      HEX.green,
      HEX.gray,
    ]);
  });
});
