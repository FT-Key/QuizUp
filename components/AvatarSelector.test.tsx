/**
 * CARACTERIZACIÓN US-21 (H1b) — `components/AvatarSelector.tsx`.
 *
 * Actualizado intencionalmente en US-21 (H1b). Congela el comportamiento nuevo:
 * - la grilla de avatares (16 por página de 32),
 * - `onSelect(seed, accessories)` al elegir un seed,
 * - el toggle de accesorios como dropdown/popover portaled con `aria-expanded`,
 *   que ya NO inserta el panel "Accesorios faciales" en el flujo del componente
 *   (por eso no provoca reflow),
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

  it("el trigger de accesorios es un dropdown portaled con aria-expanded (H1)", async () => {
    const { container } = render(
      <AvatarSelector playerName="Ana" onSelect={vi.fn()} />
    );
    const root = container.firstChild as HTMLElement;
    const childCountBefore = root.childElementCount;

    const trigger = screen.getByRole("button", {
      name: /Personalizar accesorios/,
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Accesorios faciales")).toBeNull();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(await screen.findByText("Accesorios faciales")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    // El dropdown vive en un Portal (fuera del componente): el selector no gana
    // hijos al abrirse (proxy de "no desplaza el resto").
    expect(container.textContent).not.toContain("Accesorios faciales");
    expect(root.childElementCount).toBe(childCountBefore);
  });

  it("seleccionar 'Gafas de sol' llama onSelect(seed, ['sunglasses'])", async () => {
    const onSelect = vi.fn();
    render(<AvatarSelector playerName="Ana" onSelect={onSelect} />);

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Personalizar accesorios/ }),
      { key: "ArrowDown" }
    );
    fireEvent.click(await screen.findByText("Gafas de sol"));

    expect(onSelect).toHaveBeenLastCalledWith("Ana", ["sunglasses"]);
  });
});
