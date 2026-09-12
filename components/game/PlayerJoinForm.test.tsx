/**
 * CARACTERIZACIÓN US-17 (BL-06) — `components/game/PlayerJoinForm.tsx`.
 *
 * Congela el flujo nombre → avatar y el payload exacto de `onJoin` (el padre
 * real es `app/game/[gameId]/page.tsx`: `onJoin={actions.join}`). Renderiza el
 * `AvatarSelector` real sobre localStorage; sin red ni socket.
 *
 * El no-remonte ante re-render del padre se caracteriza en
 * `app/game/[gameId]/page.test.tsx` (harness completo de la página).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerJoinForm } from "@/components/game/PlayerJoinForm";

const selectFirstAvatarSeed = (container: HTMLElement) => {
  const seedButton = container.querySelector("div.grid button");
  if (!seedButton) throw new Error("No se encontró la grilla de avatares");
  fireEvent.click(seedButton);
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PlayerJoinForm (caracterización US-17 BL-06)", () => {
  it("nombre (trim) → avatar → onJoin con playerName/avatarSeed/avatarAccessories exactos", () => {
    const onJoin = vi.fn();
    const { container } = render(<PlayerJoinForm onJoin={onJoin} />);

    const next = screen.getByRole("button", {
      name: "SIGUIENTE",
    }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Enter a display name..."), {
      target: { value: "  Carla  " },
    });
    expect(next.disabled).toBe(false);
    fireEvent.click(next);

    expect(screen.getByRole("button", { name: "JOIN GAME" })).toBeTruthy();
    selectFirstAvatarSeed(container);
    fireEvent.click(screen.getByRole("button", { name: "JOIN GAME" }));

    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledWith({
      playerName: "Carla",
      avatarSeed: "Felix",
      avatarAccessories: ["none"],
    });
  });

  it("con accesorios elegidos, onJoin lleva seed y accesorios (sin 'none')", () => {
    const onJoin = vi.fn();
    const { container } = render(<PlayerJoinForm onJoin={onJoin} />);

    fireEvent.change(screen.getByPlaceholderText("Enter a display name..."), {
      target: { value: "Carla" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SIGUIENTE" }));

    selectFirstAvatarSeed(container);
    fireEvent.click(
      screen.getByRole("button", { name: /Personalizar accesorios/i })
    );
    fireEvent.click(screen.getByRole("button", { name: "Gafas de sol" }));
    fireEvent.click(screen.getByRole("button", { name: "JOIN GAME" }));

    expect(onJoin).toHaveBeenCalledWith({
      playerName: "Carla",
      avatarSeed: "Felix",
      avatarAccessories: ["sunglasses"],
    });
  });

  it("'Atrás' vuelve al paso nombre conservando el texto y el submit vacío no avanza", () => {
    const onJoin = vi.fn();
    render(<PlayerJoinForm onJoin={onJoin} />);

    fireEvent.change(screen.getByPlaceholderText("Enter a display name..."), {
      target: { value: "Carla" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SIGUIENTE" }));
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));

    const backInput = screen.getByPlaceholderText(
      "Enter a display name..."
    ) as HTMLInputElement;
    expect(backInput.value).toBe("Carla");
    expect(screen.queryByRole("button", { name: "JOIN GAME" })).toBeNull();

    fireEvent.change(backInput, { target: { value: "   " } });
    fireEvent.submit(backInput.closest("form") as HTMLFormElement);
    expect(screen.queryByRole("button", { name: "JOIN GAME" })).toBeNull();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("precarga el nombre desde la sesión guardada", () => {
    localStorage.setItem("playerName", "Ana");
    render(<PlayerJoinForm onJoin={vi.fn()} />);

    expect(
      (screen.getByPlaceholderText("Enter a display name...") as HTMLInputElement)
        .value
    ).toBe("Ana");
  });
});
