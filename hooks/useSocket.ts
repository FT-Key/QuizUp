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
  playerName?: string; // nombre del jugador (para join-game)
  isAdmin?: boolean; // indica si es admin
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

  // inicializar solo 1 vez
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
    // join segun rol
    if (isAdmin) {
      socket.emit("join-admin", gameId);
      console.log("Joining game as ADMIN:", { gameId });
    } else if (playerName) {
      socket.emit("join-game", { gameId, playerName });
      console.log("Joining game as PLAYER:", { gameId, playerName });
    }
    // solo depende de gameId / isAdmin / playerName
  }, [gameId, isAdmin, playerName]);

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
