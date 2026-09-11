"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Copy, Check, Lock, Unlock, UserMinus, Loader2, Users, Play } from "lucide-react";
import type { Game } from "@/types";

interface AdminLobbyProps {
  game: Game;
  isStarting: boolean;
  onStart: () => void;
  onKick: (playerId: string) => void;
  onToggleLock: () => void;
  onClose: () => void;
}

export function AdminLobby({
  game,
  isStarting,
  onStart,
  onKick,
  onToggleLock,
  onClose,
}: AdminLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(game.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">

      <div className="text-center mb-6">
        <p className="text-white/80 font-bold uppercase tracking-widest mb-3 text-sm md:text-base">
          Únete con el código
        </p>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-3 md:gap-5 px-6 md:px-10 py-4 md:py-6 bg-white rounded-3xl shadow-2xl hover:scale-105 transition-transform"
          title="Copiar código"
        >
          <span className="text-5xl md:text-7xl font-black tracking-[0.12em] text-[#46178F]">
            {game.id}
          </span>
          {copied ? (
            <Check className="h-7 w-7 md:h-9 md:w-9 text-green-500" />
          ) : (
            <Copy className="h-7 w-7 md:h-9 md:w-9 text-gray-300" />
          )}
        </button>
      </div>

      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-lg md:text-2xl font-black text-gray-800 flex items-center gap-2">
            <Users className="h-5 w-5 md:h-6 md:w-6" />
            Jugadores ({game.players.length})
          </h2>

          <button
            onClick={onToggleLock}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm md:text-base
              transition-colors border-2
              ${
                game.locked
                  ? "bg-red-50 border-red-300 text-red-600 hover:bg-red-100"
                  : "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
              }
            `}
          >
            {game.locked ? (
              <>
                <Lock className="h-4 w-4 md:h-5 md:w-5" />
                Ingreso bloqueado
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 md:h-5 md:w-5" />
                Ingreso abierto
              </>
            )}
          </button>
        </div>

        {game.players.length === 0 ? (
          <div className="text-center py-14">
            <div className="text-5xl mb-3">👋</div>
            <p className="text-gray-500 text-lg font-bold">
              Esperando jugadores...
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Comparte el código <span className="font-black text-[#46178F]">{game.id}</span> para que se unan
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {game.players.map((player) => (
              <div
                key={player.id}
                className="relative bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col items-center"
              >
                <div className="animate-avatar-pop">
                  <Avatar
                    seed={player.avatar?.seed || player.name}
                    size={72}
                    expression="happy"
                    accessories={player.avatar?.accessories}
                  />
                </div>
                <span className="mt-2 font-bold text-gray-700 text-sm truncate max-w-full">
                  {player.name}
                </span>
                <button
                  onClick={() => onKick(player.id)}
                  title={`Expulsar a ${player.name}`}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/95 border border-gray-200 text-gray-300 hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onStart}
        disabled={isStarting || game.players.length === 0}
        className="mt-6 flex items-center gap-3 px-10 md:px-16 py-4 md:py-5 rounded-2xl text-xl md:text-3xl font-black text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          background: "linear-gradient(135deg, #26890C 0%, #1E7D0A 100%)",
          boxShadow: "0 8px 25px rgba(38, 137, 12, 0.45)",
        }}
      >
        {isStarting ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin" />
            Iniciando...
          </>
        ) : (
          <>
            <Play className="h-7 w-7" />
            ¡COMENZAR!
          </>
        )}
      </button>

      <div className="mt-4 flex flex-col items-center gap-2 pb-4">
        {confirmingClose ? (
          <div className="flex items-center gap-2 bg-white/95 rounded-2xl px-4 py-2 shadow-lg">
            <span className="text-sm font-bold text-gray-700">
              ¿Cerrar esta partida?
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#E21B3C] text-white text-sm font-bold hover:bg-[#C41834] transition-colors"
            >
              Sí, cerrar
            </button>
            <button
              onClick={() => setConfirmingClose(false)}
              className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingClose(true)}
            className="text-white/70 hover:text-white text-sm font-bold underline underline-offset-4 transition-colors"
          >
            Cerrar partida
          </button>
        )}
        <p className="text-white/50 text-xs text-center max-w-xs">
          Las partidas que nunca se inician se cierran solas automáticamente.
        </p>
      </div>
    </div>
  );
}
