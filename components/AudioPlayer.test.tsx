/**
 * CARACTERIZACIÓN US-22 — `components/AudioPlayer.tsx`.
 *
 * Congela el comportamiento visible ACTUAL del control de audio flotante
 * (singleton module-level `audioInstance`, autoplay best-effort, mute y slider
 * de volumen con `localStorage`) ANTES de que US-22 lo reescriba para soportar
 * playlists contextuales con crossfade y loop.
 *
 * El estado vive en un singleton a nivel de módulo, así que cada test aísla el
 * componente con `vi.resetModules()` + import dinámico: así `getAudio()` vuelve
 * a crear el `Audio` y aplica los valores iniciales de `localStorage`.
 *
 * jsdom no implementa `HTMLMediaElement.play`, por eso se stubea `global.Audio`
 * con `createAudioStub()` (ver `tests/fakes/audio.ts`). Sin red ni sockets.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioStub } from "@/tests/fakes/audio";
import type { AudioStub } from "@/tests/fakes/audio";

let stub: AudioStub;
let AudioPlayer: ComponentType;

/** Reimporta el módulo para que el singleton `audioInstance` arranque en limpio. */
async function loadAudioPlayer(): Promise<ComponentType> {
  vi.resetModules();
  const mod = await import("./AudioPlayer");
  return mod.AudioPlayer;
}

/** Dispara un click nativo en `document` (desbloquea el autoplay). */
function clickDocument(): void {
  document.dispatchEvent(new Event("click"));
}

beforeEach(async () => {
  localStorage.clear();
  stub = createAudioStub();
  vi.stubGlobal("Audio", stub.Audio);
  AudioPlayer = await loadAudioPlayer();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("AudioPlayer (caracterización US-22)", () => {
  it("antes del efecto de montaje no renderiza nada y no crea el Audio (mounted=false)", () => {
    const html = renderToStaticMarkup(<AudioPlayer />);

    expect(html).toBe("");
    expect(stub.instances).toHaveLength(0);
  });

  it("al montar crea un Audio de /QuizUp.mp3 en loop con volumen 0.4 y muted por defecto", () => {
    render(<AudioPlayer />);

    expect(stub.instances).toHaveLength(1);
    const audio = stub.last();
    expect(audio.src.endsWith("/QuizUp.mp3")).toBe(true);
    expect(audio.loop).toBe(true);
    expect(audio.preload).toBe("auto");
    expect(audio.volume).toBe(0.4);
    expect(audio.muted).toBe(true);

    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.value).toBe("40");
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Unmute");
  });

  it("valores guardados: volumen 70 se aplica (0.7 y slider 70) y quizup-muted=false quita el mute", () => {
    localStorage.setItem("quizup-volume", "70");
    localStorage.setItem("quizup-muted", "false");

    render(<AudioPlayer />);

    const audio = stub.last();
    expect(audio.volume).toBeCloseTo(0.7, 5);
    expect(audio.muted).toBe(false);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("70");
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Mute");
  });

  it("con solo el volumen guardado conserva el mute por defecto (true)", () => {
    localStorage.setItem("quizup-volume", "25");

    render(<AudioPlayer />);

    const audio = stub.last();
    expect(audio.volume).toBeCloseTo(0.25, 5);
    expect(audio.muted).toBe(true);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("25");
  });

  it("al montar intenta play() una vez, best-effort", () => {
    render(<AudioPlayer />);

    const audio = stub.last();
    expect(audio.playCallCount).toBe(1);
    expect(audio.pauseCallCount).toBe(0);
  });

  it("un play() rechazado (autoplay bloqueado) no rompe el componente ni deja promesa sin manejar", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      render(<AudioPlayer />);
      const audio = stub.last();
      expect(audio.playCallCount).toBe(1);

      audio.rejectPlay(0);
      await act(async () => {
        await Promise.resolve();
      });

      // El `.catch` interno absorbe el rechazo y el control sigue funcionando.
      expect(unhandled).toHaveLength(0);
      expect(screen.getByRole("button")).toBeTruthy();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("el primer click en document reintenta play() y desengancha los listeners", () => {
    render(<AudioPlayer />);
    const audio = stub.last();
    expect(audio.playCallCount).toBe(1);

    clickDocument();
    expect(audio.playCallCount).toBe(2);

    // Ya se quitaron los listeners: un segundo click no vuelve a intentar.
    clickDocument();
    expect(audio.playCallCount).toBe(2);
  });

  it("el primer keydown en document también desbloquea (y limpia click y keydown)", () => {
    render(<AudioPlayer />);
    const audio = stub.last();
    expect(audio.playCallCount).toBe(1);

    document.dispatchEvent(new Event("keydown"));
    expect(audio.playCallCount).toBe(2);

    clickDocument();
    document.dispatchEvent(new Event("keydown"));
    expect(audio.playCallCount).toBe(2);
  });

  it("al desmontar se limpian los listeners: un click posterior no vuelve a llamar play()", () => {
    const { unmount } = render(<AudioPlayer />);
    const audio = stub.last();
    expect(audio.playCallCount).toBe(1);

    unmount();
    clickDocument();
    document.dispatchEvent(new Event("keydown"));

    expect(audio.playCallCount).toBe(1);
  });

  it("el botón alterna el mute, actualiza aria-label y persiste quizup-muted", () => {
    render(<AudioPlayer />);
    const audio = stub.last();
    const button = screen.getByRole("button");

    expect(button.getAttribute("aria-label")).toBe("Unmute");
    expect(audio.muted).toBe(true);

    fireEvent.click(button);
    expect(audio.muted).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Mute");
    expect(localStorage.getItem("quizup-muted")).toBe("false");

    fireEvent.click(button);
    expect(audio.muted).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Unmute");
    expect(localStorage.getItem("quizup-muted")).toBe("true");
  });

  it("el slider cambia el volumen, persiste quizup-volume y a 0 activa el mute", () => {
    render(<AudioPlayer />);
    const audio = stub.last();
    const slider = screen.getByRole("slider") as HTMLInputElement;

    fireEvent.change(slider, { target: { value: "70" } });
    expect(audio.volume).toBeCloseTo(0.7, 5);
    expect(localStorage.getItem("quizup-volume")).toBe("70");
    expect(slider.value).toBe("70");

    fireEvent.change(slider, { target: { value: "0" } });
    expect(audio.volume).toBe(0);
    expect(audio.muted).toBe(true);
    expect(localStorage.getItem("quizup-muted")).toBe("true");
    expect(slider.value).toBe("0");
  });

  it("subir el slider desde 0 quita el mute y persiste quizup-muted=false", () => {
    render(<AudioPlayer />);
    const audio = stub.last();
    const slider = screen.getByRole("slider") as HTMLInputElement;

    fireEvent.change(slider, { target: { value: "0" } });
    expect(audio.muted).toBe(true);

    fireEvent.change(slider, { target: { value: "100" } });
    expect(audio.volume).toBe(1);
    expect(audio.muted).toBe(false);
    expect(localStorage.getItem("quizup-muted")).toBe("false");
  });

  it("CARACTERIZACIÓN: el singleton module-level persiste entre montajes (no se recrea el Audio)", () => {
    // Simula navegación de cliente: el componente se desmonta y remonta, pero
    // `audioInstance` sigue vivo y `getAudio()` no crea otro elemento.
    const first = render(<AudioPlayer />);
    const audio = stub.last();
    first.unmount();

    render(<AudioPlayer />);

    expect(stub.instances).toHaveLength(1);
    expect(stub.last()).toBe(audio);
  });
});
