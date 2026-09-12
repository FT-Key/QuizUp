import { describe, expect, it } from "vitest";
import { manualClock } from "@/tests/fakes/system";
import { createInMemoryIpRateLimiter } from "./in-memory-ip-rate-limiter.adapter";

// US-12 §6: ventana deslizante idéntica al legacy: 30 requests por IP en 60 s,
// hasta 1000 IPs con evicción de la más antigua; los intentos bloqueados no se
// registran (no extienden la ventana).

describe("adapters/unsplash/in-memory-ip-rate-limiter", () => {
  it("permite 30 requests por IP y bloquea la 31.ª dentro de la ventana", () => {
    const limiter = createInMemoryIpRateLimiter({ clock: manualClock(0).clock });

    for (let index = 0; index < 30; index += 1) {
      expect(limiter.hit("203.0.113.9")).toBe(false);
    }
    expect(limiter.hit("203.0.113.9")).toBe(true);
    // Otras IPs mantienen su propio cupo.
    expect(limiter.hit("198.51.100.23")).toBe(false);
  });

  it("ventana deslizante de 60 s: a los 60 s exactos los hits viejos ya no cuentan", () => {
    const clock = manualClock(0);
    const limiter = createInMemoryIpRateLimiter({ clock: clock.clock });
    for (let index = 0; index < 30; index += 1) limiter.hit("ip");

    clock.advance(59_999);
    expect(limiter.hit("ip")).toBe(true);

    clock.advance(1); // now - time === 60_000 no es < 60_000
    expect(limiter.hit("ip")).toBe(false);
  });

  it("al llegar a 1000 IPs evicta la más antigua", () => {
    const clock = manualClock(0);
    const limiter = createInMemoryIpRateLimiter({ clock: clock.clock });
    for (let index = 0; index < 30; index += 1) limiter.hit("ip-0");
    for (let index = 1; index < 1000; index += 1) limiter.hit(`ip-${index}`);

    // La 1001.ª IP distinta evicta "ip-0" (la más antigua) antes de registrarse.
    expect(limiter.hit("ip-1000")).toBe(false);

    // Si "ip-0" no se hubiera evictado seguiría bloqueada (30 hits en la ventana).
    expect(limiter.hit("ip-0")).toBe(false);
  });

  it("los reintentos bloqueados no extienden la ventana (no se registran)", () => {
    const clock = manualClock(0);
    const limiter = createInMemoryIpRateLimiter({ clock: clock.clock });
    for (let index = 0; index < 30; index += 1) limiter.hit("ip");

    clock.advance(30_000);
    expect(limiter.hit("ip")).toBe(true);

    clock.advance(29_999); // t=59_999: siguen vigentes los hits de t=0
    expect(limiter.hit("ip")).toBe(true);

    clock.advance(1); // t=60_000: la ventana descarta los hits de t=0
    expect(limiter.hit("ip")).toBe(false);
  });
});
