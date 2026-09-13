// US-22: doble mínimo de `AudioContext` para cubrir la rama Web Audio de
// `createAudioMixer` y la selección del factory. No implementa toda la interfaz
// del DOM (el adapter se somete a `unknown` + narrow); registra las ganancias y
// las llamadas observables que el adapter usa.
//
// Uso:
//   FakeAudioContext.reset();
//   vi.stubGlobal("window", { AudioContext: FakeAudioContext });
//   const mixer = createAudioMixer(element);
//   const ctx = FakeAudioContext.instances[0];
//   ctx.gains[0].gain.value; // trackGain
//   ctx.gains[1].gain.value; // masterGain
//   ctx.resumeCallCount;

export interface FakeGainParam {
  value: number;
}

export interface FakeGainNode {
  gain: FakeGainParam;
  connect(target: unknown): FakeGainNode;
}

export interface FakeAudioNode {
  connect(target: unknown): FakeAudioNode;
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: string = "suspended";
  readonly destination: unknown = { name: "destination" };
  throwOnMediaElementSource = false;
  resumeCallCount = 0;
  readonly gains: FakeGainNode[] = [];
  readonly mediaElementSources: unknown[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  static reset(): void {
    FakeAudioContext.instances = [];
  }

  createGain(): FakeGainNode {
    const node: FakeGainNode = {
      gain: { value: 1 },
      connect: () => node,
    };
    this.gains.push(node);
    return node;
  }

  createMediaElementSource(element: unknown): FakeAudioNode {
    if (this.throwOnMediaElementSource) {
      throw new Error("createMediaElementSource no soportado");
    }
    this.mediaElementSources.push(element);
    const source: FakeAudioNode = { connect: () => source };
    return source;
  }

  resume(): Promise<void> {
    this.resumeCallCount += 1;
    this.state = "running";
    return Promise.resolve();
  }
}
