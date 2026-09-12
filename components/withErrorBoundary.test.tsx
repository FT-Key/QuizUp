/**
 * US-14 — `withErrorBoundary` (Decorator): hijo envuelto, fallback por defecto
 * ante crash de render y fallback custom que recibe el error.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { withErrorBoundary } from "./withErrorBoundary";

function WorkingChild() {
  return <div>child-ok</div>;
}

function CrashingChild(): ReactElement {
  throw new Error("boom");
}

describe("withErrorBoundary (US-14)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renderiza el hijo envuelto", () => {
    const Wrapped = withErrorBoundary(WorkingChild);

    render(<Wrapped />);

    expect(screen.getByText("child-ok")).toBeTruthy();
    expect(Wrapped.displayName).toBe("withErrorBoundary(WorkingChild)");
  });

  it("hijo que lanza en render muestra el fallback por defecto", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Wrapped = withErrorBoundary(CrashingChild);

    render(<Wrapped />);

    expect(screen.getByText("Algo salió mal")).toBeTruthy();
    expect(screen.getByText("Recarga la página para continuar.")).toBeTruthy();
  });

  it("con fallback custom muestra el ReactNode provisto con el error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Wrapped = withErrorBoundary(CrashingChild, {
      fallback: (error) => <div>custom: {error.message}</div>,
    });

    render(<Wrapped />);

    expect(screen.getByText("custom: boom")).toBeTruthy();
  });
});
