/**
 * Tests de `useMusicContext` / `useMusicContextPublisher` (US-22, AC3).
 *
 * Store module-level + `useSyncExternalStore`: default queue, publicación por
 * status (solo active/finished ⇒ game), jugador sin unir ⇒ queue y aislamiento
 * entre tests con `resetMusicContext`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameStatus } from "@/core/domain/game";
import {
  resetMusicContext,
  useMusicContext,
  useMusicContextPublisher,
} from "./useMusicContext";

function ContextProbe() {
  const context = useMusicContext();
  return <span data-testid="context">{context}</span>;
}

interface PublisherProbeProps {
  gameStatus?: GameStatus | null;
  isPlayerJoined?: boolean;
}

function PublisherProbe({
  gameStatus,
  isPlayerJoined,
}: PublisherProbeProps) {
  useMusicContextPublisher(gameStatus, isPlayerJoined);
  return <ContextProbe />;
}

function readContext(): string | null {
  return screen.getByTestId("context").textContent;
}

beforeEach(() => {
  resetMusicContext();
});

afterEach(() => {
  cleanup();
  resetMusicContext();
});

describe("useMusicContext — store de contexto musical", () => {
  it("default queue sin ningún publisher", () => {
    render(<ContextProbe />);

    expect(readContext()).toBe("queue");
  });

  it("publisher active ⇒ game", () => {
    render(<PublisherProbe gameStatus="active" />);

    expect(readContext()).toBe("game");
  });

  it("publisher finished (podio) ⇒ game", () => {
    render(<PublisherProbe gameStatus="finished" />);

    expect(readContext()).toBe("game");
  });

  it("publisher waiting ⇒ queue", () => {
    render(<PublisherProbe gameStatus="waiting" />);

    expect(readContext()).toBe("queue");
  });

  it("publisher cancelled ⇒ queue", () => {
    render(<PublisherProbe gameStatus="cancelled" />);

    expect(readContext()).toBe("queue");
  });

  it("jugador sin unir con active ⇒ queue", () => {
    render(<PublisherProbe gameStatus="active" isPlayerJoined={false} />);

    expect(readContext()).toBe("queue");
  });

  it("transición waiting → active notifica al suscriptor", () => {
    const { rerender } = render(<PublisherProbe gameStatus="waiting" />);
    expect(readContext()).toBe("queue");

    rerender(<PublisherProbe gameStatus="active" />);

    expect(readContext()).toBe("game");
  });

  it("transición active → finished mantiene game", () => {
    const { rerender } = render(<PublisherProbe gameStatus="active" />);
    expect(readContext()).toBe("game");

    rerender(<PublisherProbe gameStatus="finished" />);

    expect(readContext()).toBe("game");
  });

  it("resetMusicContext vuelve a queue entre tests", () => {
    render(<PublisherProbe gameStatus="active" />);
    expect(readContext()).toBe("game");

    cleanup();
    resetMusicContext();

    render(<ContextProbe />);
    expect(readContext()).toBe("queue");
  });
});
