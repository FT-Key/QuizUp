import { describe, expect, it } from "vitest";
import type { ImageSearchPayload } from "@/core/application/ports/image-search";
import { manualClock } from "@/tests/fakes/system";
import { createInMemoryImageCache } from "./in-memory-image-cache.adapter";

// US-12 §6: semántica exacta de la caché legacy: TTL 24 h, `now > expiresAt`
// descarta, tope 200 con evicción de la clave más antigua y touch LRU en `get`.

const TTL_24H_MS = 24 * 60 * 60 * 1000;

function payload(tag: string): ImageSearchPayload {
  return {
    results: [
      {
        id: tag,
        url: `https://images.unsplash.com/${tag}.jpg`,
        alt: tag,
        author: "autor",
        authorLink: "https://unsplash.com/@autor",
      },
    ],
    page: 1,
    totalPages: 1,
  };
}

describe("adapters/unsplash/in-memory-image-cache", () => {
  it("get devuelve el payload cacheado (misma referencia) y null si no existe", () => {
    const clock = manualClock(0);
    const cache = createInMemoryImageCache({ clock: clock.clock });
    const stored = payload("foto");

    cache.set("gatos|1", stored);

    expect(cache.get("gatos|1")).toBe(stored);
    expect(cache.get("perros|1")).toBeNull();
  });

  it("expira a las 24 h exactas + 1 ms (la comparación legacy usa `>`)", () => {
    const clock = manualClock(0);
    const cache = createInMemoryImageCache({ clock: clock.clock });
    cache.set("gatos|1", payload("foto"));

    clock.set(TTL_24H_MS); // now === expiresAt: todavía válida
    expect(cache.get("gatos|1")).not.toBeNull();

    clock.set(TTL_24H_MS + 1);
    expect(cache.get("gatos|1")).toBeNull();
  });

  it("con 200 entradas expulsa la más antigua al insertar la 201.ª", () => {
    const clock = manualClock(0);
    const cache = createInMemoryImageCache({ clock: clock.clock });

    for (let index = 0; index < 200; index += 1) {
      cache.set(`q-${index}|1`, payload(`p-${index}`));
    }
    cache.set("q-200|1", payload("p-200"));

    expect(cache.get("q-0|1")).toBeNull();
    expect(cache.get("q-1|1")).not.toBeNull();
    expect(cache.get("q-200|1")).not.toBeNull();
  });

  it("get hace touch LRU: la clave consultada deja de ser la más antigua", () => {
    const clock = manualClock(0);
    const cache = createInMemoryImageCache({
      clock: clock.clock,
      maxEntries: 2,
    });
    cache.set("a|1", payload("a"));
    cache.set("b|1", payload("b"));

    cache.get("a|1"); // touch: el orden pasa a ser b, a
    cache.set("c|1", payload("c")); // expulsa b, no a

    expect(cache.get("b|1")).toBeNull();
    expect(cache.get("a|1")).not.toBeNull();
    expect(cache.get("c|1")).not.toBeNull();
  });
});
