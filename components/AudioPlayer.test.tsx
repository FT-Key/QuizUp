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

beforeEach(async () => {
  localStorage.clear();
  stub = createAudioStub();
  vi.stubGlobal("Audio", stub.Audio);
  loaded = await loadModules();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
  it("el primer click reintenta play() y desengancha click/keydown", () => {
    const player = loaded.getMusicPlayer();
    const playSpy = vi.spyOn(player, "play");
    render(<loaded.AudioPlayer />);
    const audio = stub.last();
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(audio.playCallCount).toBe(1);

    document.dispatchEvent(new Event("click"));
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(audio.playCallCount).toBe(2);

    // Ya se quitaron los listeners: ni otro click ni un keydown reintentan.
    document.dispatchEvent(new Event("click"));
    document.dispatchEvent(new Event("keydown"));
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(audio.playCallCount).toBe(2);
  });

  it("el primer keydown también desbloquea (y limpia ambos listeners)", () => {
    const player = loaded.getMusicPlayer();
    const playSpy = vi.spyOn(player, "play");
    render(<loaded.AudioPlayer />);
    expect(playSpy).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("keydown"));
    expect(playSpy).toHaveBeenCalledTimes(2);

    document.dispatchEvent(new Event("click"));
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("al desmontar se limpian los listeners: un click posterior no reintenta", () => {
    const player = loaded.getMusicPlayer();
    const playSpy = vi.spyOn(player, "play");
    const { unmount } = render(<loaded.AudioPlayer />);
    expect(playSpy).toHaveBeenCalledTimes(1);

    unmount();
    document.dispatchEvent(new Event("click"));
    document.dispatchEvent(new Event("keydown"));

    expect(playSpy).toHaveBeenCalledTimes(1);
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
