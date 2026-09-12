import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixedRetryPolicy } from "./retry-policy";

describe("createFixedRetryPolicy (Strategy de reintentos)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el delay fijo para los intentos 1..N", () => {
    const policy = createFixedRetryPolicy({ maxRetries: 5, delayMs: 3000 });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(policy.nextDelayMs(attempt)).toBe(3000);
    }
  });

  it("devuelve null al agotar el plan (N+1)", () => {
    const policy = createFixedRetryPolicy({ maxRetries: 5, delayMs: 3000 });

    expect(policy.nextDelayMs(6)).toBeNull();
  });

  it("devuelve null para intentos 0 o negativos (plan 1-based)", () => {
    const policy = createFixedRetryPolicy({ maxRetries: 5, delayMs: 3000 });

    expect(policy.nextDelayMs(0)).toBeNull();
    expect(policy.nextDelayMs(-1)).toBeNull();
  });

  it("con maxRetries 0 el plan está agotado desde el primer intento", () => {
    const policy = createFixedRetryPolicy({ maxRetries: 0, delayMs: 1000 });

    expect(policy.nextDelayMs(1)).toBeNull();
    expect(policy.nextDelayMs(0)).toBeNull();
  });

  it("es pura: no programa timers ni depende del reloj", () => {
    vi.useFakeTimers();
    const policy = createFixedRetryPolicy({ maxRetries: 2, delayMs: 500 });

    expect(policy.nextDelayMs(1)).toBe(500);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10_000);

    expect(policy.nextDelayMs(1)).toBe(500);
    expect(policy.nextDelayMs(2)).toBe(500);
    expect(policy.nextDelayMs(3)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
