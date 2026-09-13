/**
 * CARACTERIZACIÓN US-21 (H1) — `components/AvatarSelector.tsx`.
 *
 * Congela:
 * - la grilla de avatares (16 por página de 32),
 * - `onSelect(seed, accessories)` al elegir un seed,
 * - el toggle de accesorios que HOY inserta el panel "Accesorios faciales" en
 *   el flujo del componente — H1 lo convertirá en dropdown/popover,
 * - seleccionar "Gafas de sol" actualiza los accesorios.
 *
 * Renderiza el `Avatar` real (DiceBear) y usa localStorage vacío; sin red.
 *
 * NOTA DE ENTORNO: ver `JoinForm.test.tsx` (`oxc.jsx` en `vitest.config.ts`).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { describe, expect, it } from "vitest";
import { AvatarSelector } from "@/components/AvatarSelector";

const seedButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("div.grid button")) as HTMLButtonElement[];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AvatarSelector (caracterización US-21 H1)", () => {
  it("renderiza la grilla de 16 avatares de la primera página", () => {
    const { container } = render(
      <AvatarSelector playerName="Ana" onSelect={vi.fn()} />
    );

    expect(screen.getByText("Elige tu personaje")).toBeTruthy();
    expect(seedButtons(container)).toHaveLength(16);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("elegir un seed llama onSelect(seed, ['none'])", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <AvatarSelector playerName="Ana" onSelect={onSelect} />
    );

    fireEvent.click(seedButtons(container)[0]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Felix", ["none"]);
  });

  it("el botón togglea el panel de accesorios hoy en flujo (cambiará en H1)", () => {
    render(<AvatarSelector playerName="Ana" onSelect={vi.fn()} />);

    expect(screen.queryByText("Accesorios faciales")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Personalizar accesorios/ })
    );
    // US-21 (H1): hoy el panel es un <div> insertado en el flujo (empuja el
    // resto); pasará a dropdown/popover que no desplaza el componente.
    expect(screen.getByText("Accesorios faciales")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /Ocultar accesorios/ })
    );
    expect(screen.queryByText("Accesorios faciales")).toBeNull();
  });

  it("seleccionar 'Gafas de sol' llama onSelect(seed, ['sunglasses'])", () => {
    const onSelect = vi.fn();
    render(<AvatarSelector playerName="Ana" onSelect={onSelect} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Personalizar accesorios/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "Gafas de sol" }));

    expect(onSelect).toHaveBeenLastCalledWith("Ana", ["sunglasses"]);
  });
});
