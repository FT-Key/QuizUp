import type { Clock } from "@/core/application/ports/clock";

export function createSystemClock(): Clock {
  return { now: () => Date.now() };
}
