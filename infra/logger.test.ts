import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "@/infra/logger";

// US-09: el logger es un port literal del WS; se congela el formato
// `[contexto] mensaje` y el filtrado por nivel.

describe("infra/logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info emite con el prefijo de contexto", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    createLogger({ level: "info", context: "quizup-next" }).info("hola");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("[quizup-next] hola");
  });

  it("con nivel info, debug queda silenciado", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    createLogger({ level: "info", context: "quizup-next" }).debug("x");

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("con nivel error, warn/info/debug se silencian y error se emite", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger({ level: "error", context: "quizup-next" });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("[quizup-next] e");
  });

  it("con meta, el console recibe el meta como segundo argumento", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const meta = { playerId: "p1" };

    createLogger({ level: "info", context: "quizup-next" }).info("hola", meta);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("[quizup-next] hola", meta);
  });
});
