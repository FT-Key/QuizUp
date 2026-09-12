/**
 * CARACTERIZACIÓN US-13 — `JoinForm` (sesión del jugador tras el join).
 *
 * Congela el POST `/api/games/join`, las claves de `localStorage` escritas y el
 * `router.push`. Mockea `next/navigation` y `fetch`; no toca red real.
 *
 * NOTA DE ENTORNO: el tsconfig raíz usa `"jsx": "preserve"` (lo exige Next), que
 * Vite 8 respeta y deja el JSX sin transformar en Vitest. `components/tsconfig.json`
 * anida `"jsx": "react-jsx"` solo para el pipeline de tests de `components/`;
 * Next y `tsc` siguen leyendo el tsconfig raíz.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { JoinForm } from "@/components/JoinForm";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

const GAME_ID = "123456";

let fetchMock: Mock<FetchFunction>;

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response;

beforeEach(() => {
  localStorage.clear();
  mocks.push.mockReset();
  fetchMock = vi.fn<FetchFunction>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const goToAvatarStep = (container: HTMLElement) => {
  fireEvent.change(screen.getByPlaceholderText("000000"), {
    target: { value: GAME_ID },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter your name..."), {
    target: { value: "Ana" },
  });
  const form = container.querySelector("form");
  if (!form) throw new Error("No se encontró el formulario de JoinForm");
  fireEvent.submit(form);
};

const selectFirstAvatarSeed = (container: HTMLElement) => {
  const seedButton = container.querySelector("div.grid button");
  if (!seedButton) throw new Error("No se encontró la grilla de avatares");
  fireEvent.click(seedButton);
};

const waitForSubmitToFinish = async () => {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /UNIRSE/ })).toBeTruthy();
  });
};

describe("JoinForm (caracterización US-13)", () => {
  it("un join exitoso guarda la sesión con avatar y navega al juego", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ player: { id: "p1", name: "Ana" }, game: { id: GAME_ID } })
    );

    const { container } = render(<JoinForm />);
    goToAvatarStep(container);

    selectFirstAvatarSeed(container);
    fireEvent.click(screen.getByRole("button", { name: /Personalizar accesorios/i }));
    fireEvent.click(screen.getByRole("button", { name: "Gafas de sol" }));

    fireEvent.click(screen.getByRole("button", { name: /UNIRSE/ }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/game/${GAME_ID}`));

    expect(fetchMock).toHaveBeenCalledWith("/api/games/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: GAME_ID,
        playerName: "Ana",
        avatar: { seed: "Felix", accessories: ["sunglasses"] },
      }),
    });

    expect(localStorage.getItem("playerId")).toBe("p1");
    expect(localStorage.getItem("playerName")).toBe("Ana");
    expect(localStorage.getItem("playerAvatarSeed")).toBe("Felix");
    expect(localStorage.getItem("playerAvatarAccessories")).toBe(
      JSON.stringify(["sunglasses"])
    );
  });

  it("sin elegir avatar usa el nombre como seed y no escribe las claves de avatar", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ player: { id: "p1", name: "Ana" }, game: { id: GAME_ID } })
    );

    const { container } = render(<JoinForm />);
    goToAvatarStep(container);

    fireEvent.click(screen.getByRole("button", { name: /UNIRSE/ }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/game/${GAME_ID}`));

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request.body))).toEqual({
      gameId: GAME_ID,
      playerName: "Ana",
      avatar: { seed: "Ana", accessories: [] },
    });

    expect(localStorage.getItem("playerId")).toBe("p1");
    expect(localStorage.getItem("playerName")).toBe("Ana");
    expect(localStorage.getItem("playerAvatarSeed")).toBeNull();
    expect(localStorage.getItem("playerAvatarAccessories")).toBeNull();
  });

  it("CARACTERIZACIÓN: elegir avatar sin accesorios guarda [\"none\"] en localStorage aunque el body lo filtre", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ player: { id: "p1", name: "Ana" }, game: { id: GAME_ID } })
    );

    const { container } = render(<JoinForm />);
    goToAvatarStep(container);

    selectFirstAvatarSeed(container);
    fireEvent.click(screen.getByRole("button", { name: /UNIRSE/ }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/game/${GAME_ID}`));

    expect(localStorage.getItem("playerAvatarSeed")).toBe("Felix");
    expect(localStorage.getItem("playerAvatarAccessories")).toBe(JSON.stringify(["none"]));

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request.body))).toEqual({
      gameId: GAME_ID,
      playerName: "Ana",
      avatar: { seed: "Felix", accessories: [] },
    });
  });

  it("una respuesta no-ok no guarda sesión ni navega", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "El juego está bloqueado" }, false));

    const { container } = render(<JoinForm />);
    goToAvatarStep(container);

    fireEvent.click(screen.getByRole("button", { name: /UNIRSE/ }));
    await waitForSubmitToFinish();

    // CARACTERIZACIÓN: el mensaje de error no se renderiza en el paso del avatar;
    // en el código actual recién aparece al volver al paso del nombre.
    expect(screen.queryByText("El juego está bloqueado")).toBeNull();

    expect(mocks.push).not.toHaveBeenCalled();
    expect(localStorage.getItem("playerId")).toBeNull();
    expect(localStorage.getItem("playerName")).toBeNull();
    expect(localStorage.getItem("playerAvatarSeed")).toBeNull();
    expect(localStorage.getItem("playerAvatarAccessories")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByText("El juego está bloqueado")).toBeTruthy();
  });
});
