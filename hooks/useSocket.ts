"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { initSocket } from "@/lib/socket";
import type { SocketEvents } from "@/types";
import type { Socket } from "socket.io-client";

type Listener<E extends keyof SocketEvents = keyof SocketEvents> = (
  ...args: Parameters<SocketEvents[E]>
) => void;

export const useSocket = () => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket<SocketEvents> | null>(null);

  const eventQueue = useRef<{ event: keyof SocketEvents; args: any[] }[]>([]);
  const listeners = useRef<Map<keyof SocketEvents, Listener[]>>(new Map());

  // ---- Emit seguro
  const emit = useCallback(
    <E extends keyof SocketEvents>(
      event: E,
      ...args: Parameters<SocketEvents[E]>
    ) => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        // Cast necesario para cumplir tipos estrictos de socket.io-client
        (
          socket.emit as unknown as (
            ...args: [E, ...Parameters<SocketEvents[E]>]
          ) => void
        )(event, ...args);
      } else {
        eventQueue.current.push({ event, args });
      }
    },
    []
  );

  // ---- Registrar listener
  const on = useCallback(
    <E extends keyof SocketEvents>(event: E, listener: Listener<E>) => {
      const socket = socketRef.current;
      if (!listeners.current.has(event)) {
        listeners.current.set(event, []);
      }
      listeners.current.get(event)!.push(listener as Listener);

      // cast necesario
      (
        socket?.on as unknown as <K extends keyof SocketEvents>(
          event: K,
          listener: Listener<K>
        ) => void
      )?.(event, listener);
    },
    []
  );

  // ---- Eliminar listener
  const off = useCallback(
    <E extends keyof SocketEvents>(event: E, listener: Listener<E>) => {
      const socket = socketRef.current;

      // cast necesario
      (
        socket?.off as unknown as <K extends keyof SocketEvents>(
          event: K,
          listener: Listener<K>
        ) => void
      )?.(event, listener);

      const arr = listeners.current.get(event);
      if (arr) {
        listeners.current.set(
          event,
          arr.filter((l) => l !== listener)
        );
      }
    },
    []
  );

  // ---- Conexión y re-suscripción
  useEffect(() => {
    const socket = initSocket();
    socketRef.current = socket;

    if (socket.connected) setConnected(true);

    socket.on("connect", () => {
      console.log("[useSocket] connected!", socket.id);
      setConnected(true);

      // Re-suscribir listeners
      listeners.current.forEach((cbs, event) => {
        cbs.forEach((cb) =>
          (
            socket.on as unknown as <K extends keyof SocketEvents>(
              event: K,
              listener: Listener<K>
            ) => void
          )(event, cb)
        );
      });

      // Emitir eventos pendientes
      while (eventQueue.current.length > 0) {
        const { event, args } = eventQueue.current.shift()!;
        (socket.emit as unknown as (...args: [typeof event, ...any[]]) => void)(
          event,
          ...args
        );
      }
    });

    socket.on("disconnect", () => {
      console.log("[useSocket] disconnected");
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[useSocket] connect_error", err);
    });

    return () => {
      listeners.current.clear();
      eventQueue.current = [];
      // NO desconectamos el singleton
    };
  }, []);

  return { socket: socketRef.current, connected, emit, on, off };
};
