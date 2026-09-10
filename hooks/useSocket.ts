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
    const handleConnect = () => {
      setConnected(true);
      // Re-join room on reconnect
      if (isAdmin) {
        console.log("Re-joining game as ADMIN:", { gameId });
        socket.emit("join-admin", gameId);
      } else {
        const name = playerName || localStorage.getItem("playerName");
        const savedPlayerId = localStorage.getItem("playerId");
        if (name) {
          console.log("Re-joining game as PLAYER:", { gameId, name, savedPlayerId });
          socket.emit("join-game", { gameId, playerId: savedPlayerId, playerName: name });
        }
      }
    };
    const handleDisconnect = () => setConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [gameId, isAdmin]);

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
