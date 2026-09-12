import type { Socket } from "socket.io-client";
import type { RealtimeClient } from "@/core/application/ports/realtime-client";

// US-13: doble mínimo de `socket.io-client` para caracterizar `useSocket`,
// `useAdminSocket` y `adapters/socket/socket-client`. No usa estado global: cada
// llamada a `createFakeSocket()` crea un socket aislado.
//
// Los tests de hooks deben mockear el PAQUETE `socket.io-client`
// (`io: () => fake`), no la ruta del adaptador.
//
// Uso con `vi.hoisted` (el factory de `vi.mock` se eleva sobre los imports):
//
//   const mocks = vi.hoisted(() => ({ io: vi.fn() }));
//   vi.mock("socket.io-client", () => ({ io: mocks.io }));
//
//   beforeEach(() => {
//     fake = createFakeSocket();
//     mocks.io.mockReset();
//     mocks.io.mockReturnValue(asSocket(fake));
//   });

export type SocketListener = (...args: unknown[]) => void;

export interface EmittedCall {
  event: string;
  args: unknown[];
}

export interface FakeSocketOptions {
  connected?: boolean;
  id?: string;
}

export interface FakeSocket {
  connected: boolean;
  id?: string;
  on(event: string, listener: SocketListener): FakeSocket;
  off(event: string, listener: SocketListener): FakeSocket;
  emit(event: string, ...args: unknown[]): FakeSocket;
  disconnect(): void;
  /** Llamadas emitidas en orden: `{ event, args }`. */
  readonly emitted: EmittedCall[];
  /** Llamadas emitidas para un evento concreto. */
  emittedFor(event: string): EmittedCall[];
  /** Invoca los listeners registrados como si el servidor emitiera `event`. */
  trigger(event: string, ...args: unknown[]): void;
  /** Marca `connected` y dispara `connect` o `disconnect`. */
  setConnected(value: boolean): void;
  /** Cantidad de listeners registrados para `event`. */
  listenerCount(event: string): number;
}

export function createFakeSocket(options: FakeSocketOptions = {}): FakeSocket {
  const listeners = new Map<string, Set<SocketListener>>();
  const emitted: EmittedCall[] = [];

  const socket: FakeSocket = {
    connected: options.connected ?? false,
    id: options.id,
    on(event, listener) {
      const set = listeners.get(event) ?? new Set<SocketListener>();
      set.add(listener);
      listeners.set(event, set);
      return socket;
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
      return socket;
    },
    emit(event, ...args) {
      emitted.push({ event, args });
      return socket;
    },
    disconnect() {
      socket.connected = false;
    },
    get emitted() {
      return emitted;
    },
    emittedFor(event) {
      return emitted.filter((call) => call.event === event);
    },
    trigger(event, ...args) {
      const set = listeners.get(event);
      if (!set) return;
      for (const listener of [...set]) {
        listener(...args);
      }
    },
    setConnected(value) {
      socket.connected = value;
      socket.trigger(value ? "connect" : "disconnect");
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    },
  };

  return socket;
}

/** Cast de conveniencia para devolver el fake desde un `io` mockeado. */
export function asSocket(fake: FakeSocket): Socket {
  return fake as unknown as Socket;
}

/** Adapta el fake de socket.io-client al puerto `RealtimeClient`. */
export function asRealtimeClient(fake: FakeSocket): RealtimeClient {
  return {
    get connected() {
      return fake.connected;
    },
    on: (event, handler) => {
      fake.on(event, handler);
      return () => {
        fake.off(event, handler);
      };
    },
    off: (event, handler) => {
      fake.off(event, handler);
    },
    emit: (event, ...args) => {
      fake.emit(event, ...args);
    },
  };
}
