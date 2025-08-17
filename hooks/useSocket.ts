"use client";

import { useEffect, useRef, useState } from "react";
import { initSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";

export interface SocketEvent {
  event: string;
  callback: (...args: any[]) => void;
}

interface UseSocketOptions {
  gameId: string;
  playerId?: string; // opcional para admin
  events?: SocketEvent[];
}

export const useSocket = ({
  gameId,
  playerId,
  events = [],
}: UseSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // ⚡ Inicializar socket solo una vez
  if (!socketRef.current) {
    socketRef.current = initSocket();
  }

  const socket = socketRef.current;

  useEffect(() => {
    // Manejo de conexión
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      console.log("Socket core listeners cleaned up, socket stays connected");
    };
  }, []);

  useEffect(() => {
    // ⚡ Emit join-game SOLO cuando playerId esté definido, sin depender de cambios constantes
    if (playerId) {
      socket.emit("join-game", { gameId, playerId });
      console.log("Joining game as player:", { gameId, playerId });
    }
  }, [gameId, playerId]);

  useEffect(() => {
    // Registrar listeners personalizados solo una vez
    events.forEach(({ event, callback }) => socket.on(event, callback));

    return () => {
      events.forEach(({ event, callback }) => socket.off(event, callback));
      console.log("Socket event listeners cleaned up");
    };
    // No poner player/game como dependencia, sino solo los events
  }, [events]);

  const emit = (event: string, data: any) => {
    socket.emit(event, data);
  };

  return { socket, emit, connected };
};
