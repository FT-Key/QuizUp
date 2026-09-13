/**
 * Tests de `createAudioMixer` (US-22, D-D.2).
 *
 * Doble rama: Web Audio (con `FakeAudioContext` inyectado vía `window`) y
 * fallback (`element.volume`/`element.muted`) sin `AudioContext`. Proyecto
 * `unit` (entorno node): `window` se stubea con `vi.stubGlobal`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeAudioElement } from "@/tests/fakes/audio";
import { FakeAudioContext } from "@/tests/fakes/audio-context";
import { createAudioMixer } from "./audio-mixer";

/** Los fakes no implementan `HTMLAudioElement`; el adapter solo usa estas props. */
function asElement(element: FakeAudioElement): HTMLAudioElement {
  return element as unknown as HTMLAudioElement;
}

describe("createAudioMixer — Web Audio primario y fallback", () => {
  beforeEach(() => {
    FakeAudioContext.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("con AudioContext usa Web Audio y mueve trackGain/masterGain", async () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    const element = new FakeAudioElement();

    const mixer = createAudioMixer(asElement(element));

    expect(mixer.usingWebAudio).toBe(true);
    const context = FakeAudioContext.instances[0];
    expect(context.mediaElementSources).toEqual([element]);
    expect(context.gains).toHaveLength(2);

    const [trackGain, masterGain] = context.gains;
    mixer.setTrackGain(0.5);
    expect(trackGain.gain.value).toBe(0.5);
    mixer.setSilent(true);
    expect(masterGain.gain.value).toBe(0);
    mixer.setSilent(false);
    expect(masterGain.gain.value).toBe(1);

    await mixer.resume();
    expect(context.resumeCallCount).toBe(1);
  });

  it("Web Audio neutraliza volume/muted del elemento (GainNode como única fuente)", () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    const element = new FakeAudioElement();
    element.volume = 0.3;
    element.muted = true;

    createAudioMixer(asElement(element));

    expect(element.volume).toBe(1);
    expect(element.muted).toBe(false);
  });

  it("Web Audio: setTrackGain acota a [0,1]", () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    const mixer = createAudioMixer(asElement(new FakeAudioElement()));
    const [trackGain] = FakeAudioContext.instances[0].gains;

    mixer.setTrackGain(2);
    expect(trackGain.gain.value).toBe(1);
    mixer.setTrackGain(-1);
    expect(trackGain.gain.value).toBe(0);
    mixer.setTrackGain(Number.NaN);
    expect(trackGain.gain.value).toBe(0);
  });

  it("usa webkitAudioContext cuando no hay AudioContext", () => {
    vi.stubGlobal("window", { webkitAudioContext: FakeAudioContext });

    const mixer = createAudioMixer(asElement(new FakeAudioElement()));

    expect(mixer.usingWebAudio).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("sin AudioContext cae al fallback con element.volume/element.muted", async () => {
    const element = new FakeAudioElement();

    const mixer = createAudioMixer(asElement(element));

    expect(mixer.usingWebAudio).toBe(false);
    expect(FakeAudioContext.instances).toHaveLength(0);

    mixer.setTrackGain(0.3);
    expect(element.volume).toBe(0.3);
    mixer.setTrackGain(5);
    expect(element.volume).toBe(1);
    mixer.setTrackGain(Number.NaN);
    expect(element.volume).toBe(0);

    mixer.setSilent(true);
    expect(element.muted).toBe(true);
    mixer.setSilent(false);
    expect(element.muted).toBe(false);

    await expect(mixer.resume()).resolves.toBeUndefined();
  });

  it("si createMediaElementSource falla, degrada al fallback (usingWebAudio=false)", () => {
    vi.stubGlobal("window", {
      AudioContext: function ThrowingAudioContext() {
        const context = new FakeAudioContext();
        context.throwOnMediaElementSource = true;
        return context;
      },
    });
    const element = new FakeAudioElement();

    const mixer = createAudioMixer(asElement(element));

    expect(mixer.usingWebAudio).toBe(false);
    mixer.setTrackGain(0.2);
    expect(element.volume).toBe(0.2);
  });
});
