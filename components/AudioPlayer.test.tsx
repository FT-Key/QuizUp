/**
 * US-22 — `components/AudioPlayer.tsx` (reescritura declarada en el design §5.3).
 *
 * El control pasó a ser UI fina sobre `useMusicPlayer` (store de contexto +
 * `getMusicPlayer()` singleton). Este test ya no congela el comportamiento viejo
 * (`/QuizUp.mp3`, `loop=true`, `audio.volume` directo) sino el nuevo contrato:
 *
 * - tras montar hay UN elemento (`loop=false`) con la 1.ª pista de `queue`;
 * - el primer `click`/`keydown` desbloquea la reproducción (resume + play);
 * - publicar contexto `game` cambia el `src` a la playlist de partida;
 * - el slider persiste `quizup-volume` y a 0 mutea;
 * - el botón alterna `quizup-muted` y el `aria-label`;
 * - el singleton del player no se recrea al remontar (AC8).
 *
 * jsdom no implementa `HTMLMediaElement.play`/`AudioContext`: se stubea
 * `global.Audio` con `createAudioStub()` y el mixer cae al fallback
 * `element.volume`/`element.muted`. El player vive en un singleton module-level,
 * por eso cada test reimporta módulos con `vi.resetModules()` + import dinámico.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicPlayer } from "@/adapters/audio/music-player";
import { MUSIC_FADE_MS } from "@/constants/music";
import type { GameStatus } from "@/core/domain/game";
import { createAudioStub, type AudioStub } from "@/tests/fakes/audio";
import { FakeAudioContext } from "@/tests/fakes/audio-context";

type PublisherHook = (
  gameStatus?: GameStatus | null,
  isPlayerJoined?: boolean
) => void;

interface LoadedModules {
  AudioPlayer: ComponentType;
  useMusicContextPublisher: PublisherHook;
  getMusicPlayer: () => MusicPlayer;
}

let loaded: LoadedModules;
let stub: AudioStub;

/** Reimporta el grafo para que el singleton del player y el store arranquen limpios. */
async function loadModules(): Promise<LoadedModules> {
  vi.resetModules();
  const [componentModule, contextModule, playerModule] = await Promise.all([
    import("./AudioPlayer"),
    import("@/hooks/useMusicContext"),
    import("@/adapters/audio/music-player"),
  ]);
  return {
    AudioPlayer: componentModule.AudioPlayer,
    useMusicContextPublisher: contextModule.useMusicContextPublisher,
    getMusicPlayer: playerModule.getMusicPlayer,
  };
}

interface PublisherProbeProps {
  usePublisher: PublisherHook;
  status?: GameStatus | null;
}

/** Publica el contexto derivado sin agregar UI (design §5.1). */
function PublisherProbe({ usePublisher, status }: PublisherProbeProps) {
  usePublisher(status);
  return null;
}

type AudioContextWindow = { AudioContext?: unknown };

/** Instala el `AudioContext` global sin reemplazar `window` (jsdom). */
function setGlobalAudioContext(ctor: unknown): void {
  (window as unknown as AudioContextWindow).AudioContext = ctor;
}

/** Retira el `AudioContext` global para que cada test vuelva al fallback. */
function clearGlobalAudioContext(): void {
  delete (window as unknown as AudioContextWindow).AudioContext;
}

/**
 * US-23 — contenedor completo del control (`[data-volume-control]`: botón +
 * panel), sobre el que recaen `onMouseEnter`/`onMouseLeave`.
 */
function getVolumeControl(): HTMLElement {
  const control = document.querySelector("[data-volume-control]");
  if (!(control instanceof HTMLElement)) {
    throw new Error("No se encontró el control de volumen");
  }
  return control;
}

beforeEach(async () => {
  localStorage.clear();
  stub = createAudioStub();
  vi.stubGlobal("Audio", stub.Audio);
  loaded = await loadModules();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearGlobalAudioContext();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("AudioPlayer — montaje y control", () => {
  it("antes del efecto de montaje no renderiza nada ni crea el Audio (mounted=false)", () => {
    const html = renderToStaticMarkup(<loaded.AudioPlayer />);

    expect(html).toBe("");
    expect(stub.instances).toHaveLength(0);
  });

  it("renderiza el control flotante con slider y botón", () => {
    render(<loaded.AudioPlayer />);

    expect(screen.getByRole("button")).toBeTruthy();
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("40");
  });

  it("al montar crea un único Audio en loop=false con la 1.ª pista de queue", () => {
    render(<loaded.AudioPlayer />);

    expect(stub.instances).toHaveLength(1);
    const audio = stub.last();
    expect(audio.src).toContain("/music/QueueUp.mp3");
    expect(audio.loop).toBe(false);
    expect(audio.preload).toBe("auto");
    expect(audio.playCallCount).toBe(1);
  });

  it("lee quizup-volume/quizup-muted al montar y los aplica al player", () => {
    localStorage.setItem("quizup-volume", "70");
    localStorage.setItem("quizup-muted", "false");

    render(<loaded.AudioPlayer />);

    const player = loaded.getMusicPlayer();
    expect(player.getTargetVolume()).toBeCloseTo(0.7, 5);
    expect(player.isMuted()).toBe(false);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("70");
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Mute");
    expect(stub.last().muted).toBe(false);
    expect(stub.last().volume).toBeCloseTo(0.7, 5);
  });
});

describe("AudioPlayer — autoplay best-effort (AC7)", () => {
  it("el primer click reintenta play() y desbloquea el mixer, luego desengancha", () => {
    const player = loaded.getMusicPlayer();
    const playSpy = vi.spyOn(player, "play");
    const unlockSpy = vi.spyOn(player, "unlock");
    render(<loaded.AudioPlayer />);
    const audio = stub.last();
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(unlockSpy).not.toHaveBeenCalled();
    expect(audio.playCallCount).toBe(1);

    document.dispatchEvent(new Event("click"));
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(unlockSpy).toHaveBeenCalledTimes(1);
    expect(audio.playCallCount).toBe(2);

    // Ya se quitaron los listeners: ni otro click ni un keydown reintentan.
    document.dispatchEvent(new Event("click"));
    document.dispatchEvent(new Event("keydown"));
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(unlockSpy).toHaveBeenCalledTimes(1);
    expect(audio.playCallCount).toBe(2);
  });

  it("el primer keydown también desbloquea (y limpia ambos listeners)", () => {
    const player = loaded.getMusicPlayer();
    const playSpy = vi.spyOn(player, "play");
    const unlockSpy = vi.spyOn(player, "unlock");
    render(<loaded.AudioPlayer />);
    expect(playSpy).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("keydown"));
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(unlockSpy).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("click"));
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(unlockSpy).toHaveBeenCalledTimes(1);
  });

  it("al desmontar se limpian los listeners: un click posterior no reintenta", () => {
    const player = loaded.getMusicPlayer();
    const playSpy = vi.spyOn(player, "play");
    const unlockSpy = vi.spyOn(player, "unlock");
    const { unmount } = render(<loaded.AudioPlayer />);
    expect(playSpy).toHaveBeenCalledTimes(1);

    unmount();
    document.dispatchEvent(new Event("click"));
    document.dispatchEvent(new Event("keydown"));

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(unlockSpy).not.toHaveBeenCalled();
  });

  it("no instancia AudioContext en el montaje; sí en el primer gesto (AC7)", () => {
    FakeAudioContext.reset();
    setGlobalAudioContext(FakeAudioContext);
    try {
      render(<loaded.AudioPlayer />);
      expect(FakeAudioContext.instances).toHaveLength(0);

      document.dispatchEvent(new Event("click"));

      expect(FakeAudioContext.instances).toHaveLength(1);
      expect(FakeAudioContext.instances[0].resumeCallCount).toBe(1);
    } finally {
      clearGlobalAudioContext();
    }
  });

  it("un play() rechazado no rompe el control ni deja promesa sin manejar", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      render(<loaded.AudioPlayer />);
      const audio = stub.last();
      expect(audio.playCallCount).toBe(1);

      audio.rejectPlay(0);
      await act(async () => {
        await Promise.resolve();
      });

      expect(unhandled).toHaveLength(0);
      expect(screen.getByRole("button")).toBeTruthy();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("AudioPlayer — contexto musical (AC3/AC4)", () => {
  it("publicar contexto game cambia el src a la playlist de partida (crossfade)", async () => {
    // Solo se falsean los intervalos del fade: React y sus microtareas siguen reales.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    const { rerender } = render(
      <>
        <loaded.AudioPlayer />
        <PublisherProbe
          usePublisher={loaded.useMusicContextPublisher}
          status="waiting"
        />
      </>
    );
    expect(stub.last().src).toContain("/music/QueueUp.mp3");

    rerender(
      <>
        <loaded.AudioPlayer />
        <PublisherProbe
          usePublisher={loaded.useMusicContextPublisher}
          status="active"
        />
      </>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MUSIC_FADE_MS);
    });

    expect(stub.last().src).toContain("/music/QuizUp.mp3");
  });
});

describe("AudioPlayer — volumen y mute (US-20/AC6)", () => {
  it("el slider persiste quizup-volume y a 0 activa el mute", () => {
    render(<loaded.AudioPlayer />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    const player = loaded.getMusicPlayer();

    fireEvent.change(slider, { target: { value: "70" } });
    expect(localStorage.getItem("quizup-volume")).toBe("70");
    expect(player.getTargetVolume()).toBeCloseTo(0.7, 5);
    expect(stub.last().volume).toBeCloseTo(0.7, 5);
    expect(slider.value).toBe("70");

    fireEvent.change(slider, { target: { value: "0" } });
    expect(localStorage.getItem("quizup-volume")).toBe("0");
    expect(localStorage.getItem("quizup-muted")).toBe("true");
    expect(player.isMuted()).toBe(true);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Unmute");
  });

  it("subir el slider desde 0 quita el mute y persiste quizup-muted=false", () => {
    render(<loaded.AudioPlayer />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    const player = loaded.getMusicPlayer();

    fireEvent.change(slider, { target: { value: "0" } });
    expect(player.isMuted()).toBe(true);

    fireEvent.change(slider, { target: { value: "100" } });
    expect(player.isMuted()).toBe(false);
    expect(localStorage.getItem("quizup-muted")).toBe("false");
    expect(stub.last().volume).toBe(1);
  });

  it.each([
    ["150", "100", 1],
    ["-20", "0", 0],
    ["no-numero", "40", 0.4],
  ])(
    "acota quizup-volume=%s al rango del slider (%s)",
    (saved, expectedSlider, expectedTarget) => {
      localStorage.setItem("quizup-volume", saved);

      render(<loaded.AudioPlayer />);

      expect((screen.getByRole("slider") as HTMLInputElement).value).toBe(
        expectedSlider
      );
      expect(loaded.getMusicPlayer().getTargetVolume()).toBeCloseTo(
        expectedTarget,
        5
      );
    }
  );

  it("el botón alterna el mute, actualiza aria-label y persiste quizup-muted", () => {
    render(<loaded.AudioPlayer />);
    const button = screen.getByRole("button");
    const player = loaded.getMusicPlayer();

    expect(button.getAttribute("aria-label")).toBe("Unmute");
    expect(player.isMuted()).toBe(true);

    fireEvent.click(button);
    expect(player.isMuted()).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Mute");
    expect(localStorage.getItem("quizup-muted")).toBe("false");

    fireEvent.click(button);
    expect(player.isMuted()).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Unmute");
    expect(localStorage.getItem("quizup-muted")).toBe("true");
  });
});

describe("AudioPlayer — panel de volumen (US-23 H1)", () => {
  it("mouseenter sobre el control abre el panel y mouseleave lo cierra (AC1)", () => {
    render(<loaded.AudioPlayer />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.mouseEnter(getVolumeControl());
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.mouseLeave(getVolumeControl());
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("el click del botón alterna mute sin que el mouse altere el panel (AC1)", () => {
    render(<loaded.AudioPlayer />);
    const button = screen.getByRole("button");
    const player = loaded.getMusicPlayer();
    fireEvent.mouseEnter(getVolumeControl());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(player.isMuted()).toBe(true);

    fireEvent.pointerDown(button, { pointerType: "mouse" });
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(button);
    expect(player.isMuted()).toBe(false);
    expect(localStorage.getItem("quizup-muted")).toBe("false");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("pointerdown táctil abre y vuelve a cerrar el panel (AC2)", () => {
    render(<loaded.AudioPlayer />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.pointerDown(button, { pointerType: "touch" });
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.pointerDown(button, { pointerType: "touch" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("un tap real (pointerdown touch + click) abre el panel y, además, alterna el mute (comportamiento actual)", () => {
    render(<loaded.AudioPlayer />);
    const button = screen.getByRole("button");
    const player = loaded.getMusicPlayer();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(player.isMuted()).toBe(true);

    // Un tap táctil real despacha primero `pointerdown` y luego `click`.
    // Comportamiento actual y aceptado por el review de US-23: el `pointerdown`
    // alterna el panel (false -> true) y el `click` posterior alterna el mute
    // (true -> false), de modo que un solo tap hace ambas cosas. No se desacopla
    // el mute del tap para no cambiar la interacción existente; si se decidiera
    // que un tap solo abre/cierra el panel, habría que frenar el click táctil y
    // este test pasaría a esperar aria-expanded=true y muted sin cambios.
    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(player.isMuted()).toBe(false);
    expect(localStorage.getItem("quizup-muted")).toBe("false");
  });

  it("el slider sigue usable con el panel abierto por hover (AC1)", () => {
    render(<loaded.AudioPlayer />);
    const slider = screen.getByRole("slider") as HTMLInputElement;

    fireEvent.mouseEnter(getVolumeControl());
    fireEvent.change(slider, { target: { value: "70" } });

    expect(slider.value).toBe("70");
    expect(localStorage.getItem("quizup-volume")).toBe("70");
    expect(loaded.getMusicPlayer().getTargetVolume()).toBeCloseTo(0.7, 5);
  });

  it("el click-outside sigue cerrando el panel abierto por hover", () => {
    render(<loaded.AudioPlayer />);
    const button = screen.getByRole("button");

    fireEvent.mouseEnter(getVolumeControl());
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("AudioPlayer — singleton (AC8)", () => {
  it("el player module-level persiste al remontar y no recrea el Audio", () => {
    const first = render(<loaded.AudioPlayer />);
    const audio = stub.last();
    first.unmount();

    render(<loaded.AudioPlayer />);

    expect(stub.instances).toHaveLength(1);
    expect(stub.last()).toBe(audio);
  });
});
