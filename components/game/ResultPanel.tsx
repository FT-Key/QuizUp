"use client";

import { Avatar } from "@/components/Avatar";
import type { PlayerAnswerResult } from "@/core/domain/game/phase-resolver";

interface ResultPanelProps {
  hasSubmitted: boolean;
  isQuestionFinished: boolean;
  playerAnswerResult: PlayerAnswerResult | null;
  avatarSeed: string;
  accessories: string[];
}

export function ResultPanel({
  hasSubmitted,
  isQuestionFinished,
  playerAnswerResult,
  avatarSeed,
  accessories,
}: ResultPanelProps) {
  if (playerAnswerResult && hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="animate-avatar-pop">
          <Avatar
            seed={avatarSeed}
            size={120}
            expression={playerAnswerResult.correct ? "happy" : "sad"}
            accessories={accessories}
          />
        </div>
        {playerAnswerResult.correct ? (
          <div className="animate-slide-in-up">
            <p className="text-green-400 text-2xl font-black">✅ ¡Correcto!</p>
            <p className="text-white text-lg">
              +{playerAnswerResult.score} puntos
            </p>
          </div>
        ) : (
          <div className="animate-slide-in-up">
            <p className="text-red-400 text-2xl font-black">❌ Incorrecto</p>
            <p className="text-white/70">Mejor suerte la próxima vez</p>
          </div>
        )}
      </div>
    );
  }

  if (isQuestionFinished) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="animate-avatar-pop">
          <Avatar
            seed={avatarSeed}
            size={120}
            expression="sad"
            accessories={accessories}
          />
        </div>
        <div className="animate-slide-in-up">
          <p className="text-yellow-400 text-2xl font-black">⏰ ¡Tiempo!</p>
          <p className="text-white/70">No enviaste respuesta</p>
        </div>
      </div>
    );
  }

  return null;
}
