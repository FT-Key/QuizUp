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
  playerName?: string;
  isAdmin?: boolean;
  events?: SocketEvent[];
}

export const useSocket = ({
  gameId,
  playerName,
  isAdmin = false,
  events = [],
}: UseSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = initSocket();
  }

  const socket = socketRef.current;

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      console.log("Socket core listeners cleaned up");
    };
  }, []);

  useEffect(() => {
    // Solo emitimos join cuando el socket realmente está conectado
    if (!socket.connected) return;

    if (isAdmin) {
      console.log("Joining game as ADMIN:", { gameId });
      socket.emit("join-admin", gameId);
    } else if (playerName) {
      console.log("Joining game as PLAYER:", { gameId, playerName });
      socket.emit("join-game", { gameId, playerName });
    }
  }, [socket.connected, gameId, isAdmin, playerName]);

  useEffect(() => {
    // registrar listeners personalizados
    events.forEach(({ event, callback }) => socket.on(event, callback));
    return () => {
      events.forEach(({ event, callback }) => socket.off(event, callback));
      console.log("Socket event listeners cleaned up");
    };
  }, [events]);

  const emit = (event: string, data?: any) => {
    socket.emit(event, data);
  };

  return { socket, emit, connected };
};
