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

      if (isAdmin) {

        socket.emit("join-admin", gameId);
      } else {
        const name = playerName || localStorage.getItem("playerName");
        const savedPlayerId = localStorage.getItem("playerId");
        const savedAvatarSeed = localStorage.getItem("playerAvatarSeed");
        let savedAccessories: string[] = [];
        try {
          const raw = localStorage.getItem("playerAvatarAccessories");
          if (raw) savedAccessories = JSON.parse(raw);
        } catch {}
        if (name) {

          socket.emit("join-game", {
            gameId,
            playerId: savedPlayerId,
            playerName: name,
            avatar: { seed: savedAvatarSeed || name, accessories: savedAccessories },
          });
        }
      }
    };
    const handleDisconnect = () => setConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [gameId, isAdmin]);

  useEffect(() => {

    events.forEach(({ event, callback }) => socket.on(event, callback));
    return () => {
      events.forEach(({ event, callback }) => socket.off(event, callback));

    };
  }, [events]);

  const emit = (event: string, data?: any) => {
    socket.emit(event, data);
  };

  return { socket, emit, connected };
};
