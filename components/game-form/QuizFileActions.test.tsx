/**
 * CARACTERIZACIÓN US-21 (H4) — `components/game-form/QuizFileActions.tsx`.
 *
 * Congela el ESTADO PREVIO a H4: el ítem "Exportar (.quizup)" está SIEMPRE
 * habilitado y exporta incluso con el draft vacío (payload real de
 * `buildQuizExportPayload`). US-21 lo deshabilitará cuando el draft no cumpla
 * los mínimos (`!isValidDraft`).
 *
 * Mockea `sonner` y `URL.createObjectURL`/`revokeObjectURL`; usa el parser real
 * de `core/domain/quiz-file`. Sin red.
 *
 * NOTA DE ENTORNO: ver `JoinForm.test.tsx` (`oxc.jsx` en `vitest.config.ts`).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  createEmptyQuizDraft,
  type QuizDraft,
} from "@/core/application/builders/quiz-builder";
import { QuizFileActions } from "@/components/game-form/QuizFileActions";

const sonnerMock = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: sonnerMock.error } }));

let capturedBlob: Blob | null;
let clickedAnchor: HTMLAnchorElement | null;
let createObjectURL: Mock<(blob: Blob) => string>;
let revokeObjectURL: Mock<(url: string) => void>;

beforeEach(() => {
  sonnerMock.error.mockClear();
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
  vi.restoreAllMocks();
});

const openFileMenu = async () => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Archivo/ }), {
    key: "ArrowDown",
  });
  await screen.findByText("Exportar (.quizup)");
};

const menuItemFor = (label: string): Element => {
  const item = screen.getByText(label).closest('[role="menuitem"]');
  if (!item) throw new Error(`No se encontró el ítem ${label}`);
  return item;
};

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

const renderActions = (draft: QuizDraft = createEmptyQuizDraft()) => {
  const onImport = vi.fn();
  const utils = render(<QuizFileActions draft={draft} onImport={onImport} />);
  return { ...utils, onImport };
};

describe("QuizFileActions (caracterización US-21 H4)", () => {
  it("con draft vacío el ítem 'Exportar (.quizup)' existe y NO está deshabilitado (previo a H4)", async () => {
    renderActions();
    await openFileMenu();

    const exportItem = menuItemFor("Exportar (.quizup)");
    // US-21 (H4): pasará a `data-disabled="true"` cuando !isValidDraft.
    expect(exportItem.getAttribute("data-disabled")).toBeNull();
    expect(exportItem.getAttribute("aria-disabled")).toBeNull();

    expect(screen.getByText("Importar (.quizup)")).toBeTruthy();
  });

  it("exporta el draft vacío: descarga .quizup con 'Quiz sin nombre'", async () => {
    renderActions();
    await openFileMenu();
    fireEvent.click(screen.getByText("Exportar (.quizup)"));

    if (!capturedBlob) {
      throw new Error("handleExport no llamó a URL.createObjectURL");
    }
    const payload = JSON.parse(await capturedBlob.text());

    expect(payload).toEqual({
      format: "quizup",
      version: 1,
      exportedAt: expect.any(String),
      name: "Quiz sin nombre",
      questionTimeLimit: 20000,
      questions: [{ text: "", options: ["", "", "", ""], correctAnswer: 0 }],
    });
    expect(clickedAnchor?.download).toBe("quiz.quizup");
    expect(clickedAnchor?.href).toBe("blob:mock");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("importar un archivo inválido alerta con el prefijo exacto y no llama onImport", async () => {
    const { container, onImport } = renderActions();
    const file = new File(["esto no es json"], "roto.quizup");

    fireEvent.change(fileInput(container), { target: { files: [file] } });

    await waitFor(() =>
      expect(sonnerMock.error).toHaveBeenCalledWith(
        "Archivo .quizup inválido:\nEl archivo no es un JSON válido."
      )
    );
    expect(onImport).not.toHaveBeenCalled();
  });

  it("importar un archivo válido llama onImport con el quiz saneado", async () => {
    const { container, onImport } = renderActions();
    const file = new File(
      [
        JSON.stringify({
          format: "quizup",
          version: 1,
          name: "Importado",
          questionTimeLimit: 30000,
          questions: [
            { text: "P1", options: ["a", "b", "c", "d"], correctAnswer: 1 },
          ],
        }),
      ],
      "quiz.quizup",
      { type: "application/json" }
    );

    fireEvent.change(fileInput(container), { target: { files: [file] } });

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0]).toMatchObject({
      name: "Importado",
      questionTimeLimit: 30000,
      questions: [
        {
          text: "P1",
          options: ["a", "b", "c", "d"],
          correctAnswer: 1,
          image: null,
        },
      ],
    });
  });
});
