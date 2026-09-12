/**
 * CARACTERIZACIÓN US-14 — `GameForm`.
 *
 * Congela el formulario actual (estado, validación, POST /api/games, import /
 * export .quizup y mensajes de alert) antes de extraer `useQuizDraft`,
 * `QuestionEditor`, `TimeLimitSelector`, `QuizFileActions` y `QuizBuilder`.
 *
 * Mockea solo `next/navigation` y `fetch`; `ImagePicker` (Radix Dialog cerrado)
 * se renderiza real y no fetchea al montar. Nada de red real.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { GameForm } from "@/components/GameForm";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response;

let fetchMock: Mock<FetchFunction>;
let alertSpy: ReturnType<typeof vi.spyOn>;
let createObjectURL: Mock<(blob: Blob) => string>;
let revokeObjectURL: Mock<(url: string) => void>;
let capturedBlob: Blob | null;
let clickedAnchor: HTMLAnchorElement | null;

const OPTION_PLACEHOLDERS = ["Red", "Blue", "Green", "Yellow"] as const;

const changeInput = (element: Element, value: string) =>
  fireEvent.change(element, { target: { value } });

const submitButton = () =>
  screen.getByRole("button", { name: /CREATE QUIZ/ }) as HTMLButtonElement;

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

const trashButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("svg.lucide-trash2")).map((svg) =>
    svg.closest("button")
  ) as HTMLButtonElement[];

const fillValidQuestion = ({
  text = "¿2+2?",
  options = ["1", "2", "3", "4"],
}: { text?: string; options?: string[] } = {}) => {
  changeInput(screen.getByPlaceholderText("Type your question here..."), text);
  options.forEach((value, index) => {
    changeInput(screen.getByPlaceholderText(OPTION_PLACEHOLDERS[index]), value);
  });
};

const openFileMenu = async () => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Archivo/ }), {
    key: "ArrowDown",
  });
  await screen.findByText("Exportar (.quizup)");
};

const exportPayload = async () => {
  await openFileMenu();
  fireEvent.click(screen.getByText("Exportar (.quizup)"));
  const blob = capturedBlob;
  if (!blob) throw new Error("handleExport no llamó a URL.createObjectURL");
  return JSON.parse(await blob.text());
};

beforeEach(() => {
  localStorage.clear();
  mocks.push.mockReset();
  fetchMock = vi.fn<FetchFunction>();
  vi.stubGlobal("fetch", fetchMock);
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

  capturedBlob = null;
  clickedAnchor = null;
  createObjectURL = vi.fn((blob: Blob) => {
    capturedBlob = blob;
    return "blob:mock";
  });
  revokeObjectURL = vi.fn();
  (URL as unknown as Record<string, unknown>).createObjectURL = createObjectURL;
  (URL as unknown as Record<string, unknown>).revokeObjectURL = revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function (this: HTMLAnchorElement) {
      clickedAnchor = this;
    }
  );
});

afterEach(() => {
  cleanup();
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GameForm (caracterización US-14)", () => {
  it("estado inicial: 1 pregunta, nombre vacío, 20s seleccionado y submit deshabilitado", () => {
    const { container } = render(<GameForm />);

    expect(screen.getByText("Quiz Name")).toBeTruthy();
    expect(screen.getByText("Time per Question")).toBeTruthy();
    expect(screen.getByText("Questions (1)")).toBeTruthy();
    expect(screen.getByText("Question 1")).toBeTruthy();

    const nameInput = container.querySelector("#gameName") as HTMLInputElement;
    expect(nameInput.value).toBe("");
    expect(nameInput.getAttribute("maxlength")).toBe("80");

    expect(
      screen.getByPlaceholderText("Type your question here...").getAttribute("maxlength")
    ).toBe("300");
    expect(screen.getByPlaceholderText("Red").getAttribute("maxlength")).toBe("120");

    const btn20 = screen.getByRole("button", { name: "20s" });
    const btn30 = screen.getByRole("button", { name: "30s" });
    const btn40 = screen.getByRole("button", { name: "40s" });
    expect(btn20.className).toContain("bg-white");
    expect(btn20.className).toContain("text-[#46178F]");
    expect(btn30.className).toContain("text-gray-500");
    expect(btn40.className).toContain("text-gray-500");

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toBe("CREATE QUIZ (1 Question)");

    // Con 1 sola pregunta no hay botón de borrar.
    expect(trashButtons(container)).toHaveLength(0);

    const input = fileInput(container);
    expect(input.getAttribute("accept")).toBe(".quizup,.json,application/json");
    expect(input.className).toContain("hidden");
  });

  it("Add Question agrega preguntas y el botón de borrar solo aparece con más de una", () => {
    const { container } = render(<GameForm />);

    fireEvent.click(screen.getByRole("button", { name: /Add Question/ }));

    expect(screen.getByText("Questions (2)")).toBeTruthy();
    expect(screen.getByText("Question 2")).toBeTruthy();
    expect(submitButton().textContent).toBe("CREATE QUIZ (2 Questions)");
    expect(trashButtons(container)).toHaveLength(2);

    fireEvent.click(trashButtons(container)[0]);

    expect(screen.getByText("Questions (1)")).toBeTruthy();
    expect(screen.queryByText("Question 2")).toBeNull();
    expect(trashButtons(container)).toHaveLength(0);
  });

  it("eliminar la primera de dos preguntas conserva el contenido de la segunda", () => {
    const { container } = render(<GameForm />);

    changeInput(screen.getByPlaceholderText("Type your question here..."), "A");
    fireEvent.click(screen.getByRole("button", { name: /Add Question/ }));
    changeInput(screen.getAllByPlaceholderText("Type your question here...")[1], "B");

    fireEvent.click(trashButtons(container)[0]);

    expect(screen.getByText("Questions (1)")).toBeTruthy();
    expect(screen.getByDisplayValue("B")).toBeTruthy();
    expect(screen.queryByDisplayValue("A")).toBeNull();
  });

  it("submit deshabilitado hasta nombre + texto + 4 opciones no vacías", () => {
    render(<GameForm />);

    changeInput(screen.getByPlaceholderText("Enter your quiz name..."), "Mi Quiz");
    expect(submitButton().disabled).toBe(true);

    changeInput(screen.getByPlaceholderText("Type your question here..."), "¿2+2?");
    expect(submitButton().disabled).toBe(true);

    changeInput(screen.getByPlaceholderText("Red"), "1");
    changeInput(screen.getByPlaceholderText("Blue"), "2");
    changeInput(screen.getByPlaceholderText("Green"), "3");
    expect(submitButton().disabled).toBe(true);

    changeInput(screen.getByPlaceholderText("Yellow"), "4");
    expect(submitButton().disabled).toBe(false);

    // Una opción con solo espacios vuelve a invalidar.
    changeInput(screen.getByPlaceholderText("Yellow"), "   ");
    expect(submitButton().disabled).toBe(true);
  });

  it("submit OK hace POST /api/games con el body exacto (imagen null) y navega al admin", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ game: { id: "game-42" } }));

    render(<GameForm />);
    changeInput(screen.getByPlaceholderText("Enter your quiz name..."), "Mi Quiz");
    fillValidQuestion();

    fireEvent.click(screen.getByRole("button", { name: "40s" }));
    expect(screen.getByRole("button", { name: "40s" }).className).toContain("bg-white");

    fireEvent.click(screen.getAllByTitle("Mark as correct answer")[2]);
    expect(screen.getByText("Green")).toBeTruthy();

    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/game/game-42/admin")
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/games");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Mi Quiz",
      questionTimeLimit: 40000,
      questions: [
        {
          text: "¿2+2?",
          options: ["1", "2", "3", "4"],
          correctAnswer: 2,
          image: null,
        },
      ],
    });
  });

  it("submit con respuesta no-ok alerta el mensaje exacto, no navega y reactiva el botón", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, false));

    render(<GameForm />);
    changeInput(screen.getByPlaceholderText("Enter your quiz name..."), "Mi Quiz");
    fillValidQuestion();
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Failed to create game. Please try again."
      )
    );
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => expect(submitButton().disabled).toBe(false));
  });

  it("submit con fetch rechazado usa el mismo alert y no navega", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    render(<GameForm />);
    changeInput(screen.getByPlaceholderText("Enter your quiz name..."), "Mi Quiz");
    fillValidQuestion();
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Failed to create game. Please try again."
      )
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("Exportar .quizup genera el payload exacto y el nombre de archivo saneado", async () => {
    render(<GameForm />);
    changeInput(
      screen.getByPlaceholderText("Enter your quiz name..."),
      "Mi Quiz 1!"
    );
    fillValidQuestion({ text: "Pregunta", options: ["a", "b", "c", "d"] });

    const payload = await exportPayload();

    expect(payload).toEqual({
      format: "quizup",
      version: 1,
      exportedAt: expect.any(String),
      name: "Mi Quiz 1!",
      questionTimeLimit: 20000,
      questions: [
        {
          text: "Pregunta",
          options: ["a", "b", "c", "d"],
          correctAnswer: 0,
        },
      ],
    });
    expect(String(payload.exportedAt)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );

    // CARACTERIZACIÓN: el regex deja "_" finales ("Mi Quiz 1!" → "Mi_Quiz_1_").
    expect(clickedAnchor?.download).toBe("Mi_Quiz_1_.quizup");
    expect(clickedAnchor?.href).toBe("blob:mock");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("Exportar sin nombre usa 'Quiz sin nombre' y quiz.quizup", async () => {
    render(<GameForm />);
    fillValidQuestion();

    const payload = await exportPayload();

    expect(payload.name).toBe("Quiz sin nombre");
    expect(payload.questions).toHaveLength(1);
    expect(clickedAnchor?.download).toBe("quiz.quizup");
  });

  it("Exportar incluye image solo cuando la pregunta tiene un url (import de Unsplash)", async () => {
    const { container } = render(<GameForm />);
    const file = new File(
      [
        JSON.stringify({
          format: "quizup",
          version: 1,
          questions: [
            {
              text: "Con imagen",
              options: ["a", "b", "c", "d"],
              correctAnswer: 0,
              image: { url: "https://images.unsplash.com/photo-1", alt: "Gato" },
            },
          ],
        }),
      ],
      "img.quizup"
    );

    fireEvent.change(fileInput(container), { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByDisplayValue("Con imagen")).toBeTruthy()
    );

    const payload = await exportPayload();

    expect(payload.questions[0].image).toEqual({
      url: "https://images.unsplash.com/photo-1",
      alt: "Gato",
    });
  });

  it("Importar un .quizup válido reemplaza preguntas, nombre y límite de tiempo", async () => {
    const { container } = render(<GameForm />);
    const file = new File(
      [
        JSON.stringify({
          format: "quizup",
          version: 1,
          name: "Importado",
          questionTimeLimit: 30000,
          questions: [
            { text: "P1", options: ["a", "b", "c", "d"], correctAnswer: 2 },
            { text: "P2", options: ["e", "f", "g", "h"], correctAnswer: 0 },
          ],
        }),
      ],
      "quiz.quizup",
      { type: "application/json" }
    );

    fireEvent.change(fileInput(container), { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText("Questions (2)")).toBeTruthy()
    );
    expect(
      (screen.getByPlaceholderText("Enter your quiz name...") as HTMLInputElement)
        .value
    ).toBe("Importado");
    expect(screen.getByDisplayValue("P1")).toBeTruthy();
    expect(screen.getByDisplayValue("a")).toBeTruthy();
    expect(screen.getByRole("button", { name: "30s" }).className).toContain(
      "bg-white"
    );
  });

  it("Importar un JSON inválido alerta con el prefijo 'Archivo .quizup inválido:'", async () => {
    const { container } = render(<GameForm />);
    const file = new File(["esto no es json"], "roto.quizup");

    fireEvent.change(fileInput(container), { target: { files: [file] } });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Archivo .quizup inválido:\nEl archivo no es un JSON válido."
      )
    );
  });

  it("Importar un archivo > 2 MB alerta sin leer el contenido", () => {
    const { container } = render(<GameForm />);
    const file = new File(
      [new Uint8Array(2 * 1024 * 1024 + 1)],
      "grande.quizup"
    );
    const textSpy = vi.spyOn(file, "text");

    fireEvent.change(fileInput(container), { target: { files: [file] } });

    expect(alertSpy).toHaveBeenCalledWith(
      "El archivo es demasiado grande. El máximo permitido es 2 MB."
    );
    expect(textSpy).not.toHaveBeenCalled();
  });
});
