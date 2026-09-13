// US-22: doble de `HTMLAudioElement` para los tests de `AudioPlayer` y de la
// orquestación de playlists/crossfade. Es **genérico** (no conoce rutas de
// canciones): registra `src`, `volume`, `muted`, `loop`, `preload`, los
// contadores de `play()`/`pause()`, permite controlar la promesa de `play()`
// (resolver/rechazar, para el `catch` best-effort del autoplay) y emitir el
// evento `ended` (avance de playlist).
//
// No depende de jsdom: jsdom no implementa `HTMLMediaElement.play`, así que se
// instala con `vi.stubGlobal("Audio", stub.Audio)` y cada `new Audio(...)` del
// código bajo prueba devuelve un `FakeAudioElement` observable.
//
//   const stub = createAudioStub();
//   vi.stubGlobal("Audio", stub.Audio);
//   ...
//   stub.last().playCallCount;      // veces que el código llamó a play()
//   stub.last().resolvePlay();      // simula autoplay aceptado (paused = false)
//   stub.last().rejectPlay();       // simula autoplay bloqueado (paused sigue true)
//   stub.last().emitEnded();        // dispara `ended` (siguiente pista)

export interface FakeAudioEvent {
  type: string;
}

export type FakeAudioListener = (event: FakeAudioEvent) => void;

/** Promesa de `play()` controlable desde el test. */
export interface DeferredPlay {
  readonly promise: Promise<void>;
  readonly settled: boolean;
  resolve(): void;
  reject(reason?: unknown): void;
}

function createDeferredPlay(): DeferredPlay {
  let settle: (() => void) | null = null;
  let fail: ((reason?: unknown) => void) | null = null;
  let settled = false;

  const promise = new Promise<void>((resolve, reject) => {
    settle = () => {
      settled = true;
      resolve();
    };
    fail = (reason?: unknown) => {
      settled = true;
      reject(reason);
    };
  });

  return {
    promise,
    get settled(): boolean {
      return settled;
    },
    resolve: () => settle?.(),
    reject: (reason?: unknown) => fail?.(reason),
  };
}

export class FakeAudioElement {
  src = "";
  volume = 1;
  muted = false;
  loop = false;
  preload = "";
  currentTime = 0;
  paused = true;

  playCallCount = 0;
  pauseCallCount = 0;

  private readonly listeners = new Map<string, Set<FakeAudioListener>>();
  private readonly plays: DeferredPlay[] = [];

  constructor(src?: string) {
    if (src !== undefined) this.src = src;
  }

  play(): Promise<void> {
    this.playCallCount += 1;
    const deferred = createDeferredPlay();
    this.plays.push(deferred);
    return deferred.promise;
  }

  pause(): void {
    this.pauseCallCount += 1;
    this.paused = true;
  }

  /** Promesas de `play()` en orden de llamada. */
  get playCalls(): readonly DeferredPlay[] {
    return this.plays;
  }

  /** Resuelve `play()` en `index` (default: la última) y marca `paused = false`. */
  resolvePlay(index = this.plays.length - 1): void {
    const deferred = this.plays[index];
    if (!deferred) {
      throw new Error(`FakeAudioElement.resolvePlay: no existe play #${index}`);
    }
    deferred.resolve();
    this.paused = false;
  }

  /** Rechaza `play()` en `index` (default: la última); `paused` sigue en true. */
  rejectPlay(
    index = this.plays.length - 1,
    reason: unknown = new Error("autoplay bloqueado")
  ): void {
    const deferred = this.plays[index];
    if (!deferred) {
      throw new Error(`FakeAudioElement.rejectPlay: no existe play #${index}`);
    }
    deferred.reject(reason);
    this.paused = true;
  }

  addEventListener(type: string, listener: FakeAudioListener): void {
    const set = this.listeners.get(type) ?? new Set<FakeAudioListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: FakeAudioListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  dispatchEvent(event: FakeAudioEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) return;
    for (const listener of [...set]) {
      listener(event);
    }
  }

  /** Emite `ended`: la playlist debe avanzar a la siguiente pista. */
  emitEnded(): void {
    this.dispatchEvent({ type: "ended" });
  }
}

export interface AudioStub {
  /** Pasar a `vi.stubGlobal("Audio", stub.Audio)`. */
  Audio: new (src?: string) => FakeAudioElement;
  /** Todos los elementos creados, en orden. */
  instances: FakeAudioElement[];
  /** Último elemento creado (falla si no hubo ninguno). */
  last(): FakeAudioElement;
}

/** Crea un constructor `Audio` controlable con instancias observables. */
export function createAudioStub(): AudioStub {
  const instances: FakeAudioElement[] = [];

  function AudioConstructor(this: unknown, src?: string): FakeAudioElement {
    const element = new FakeAudioElement(src);
    instances.push(element);
    return element;
  }

  return {
    Audio: AudioConstructor as unknown as new (src?: string) => FakeAudioElement,
    instances,
    last: () => {
      const element = instances[instances.length - 1];
      if (!element) {
        throw new Error("createAudioStub: no se creó ningún elemento de audio");
      }
      return element;
    },
  };
}
