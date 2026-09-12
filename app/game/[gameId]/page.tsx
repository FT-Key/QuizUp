"use client";

import { useParams } from "next/navigation";
import { Clock, Loader2, Users } from "lucide-react";
import { withErrorBoundary } from "@/components/withErrorBoundary";
import { useGameSession } from "@/hooks/useGameSession";
import { GAME_PHASE } from "@/hooks/game-session/constants";
import { GAME_STATUS } from "@/core/domain/game/constants";
import { AnswerPanel } from "@/components/game/AnswerPanel";
import { CancelledPanel } from "@/components/game/CancelledPanel";
import { FinishedPanel } from "@/components/game/FinishedPanel";
import { PlayerJoinForm } from "@/components/game/PlayerJoinForm";
import { ResultPanel } from "@/components/game/ResultPanel";
import { ScoreboardPanel } from "@/components/game/ScoreboardPanel";
import { WaitingPanel } from "@/components/game/WaitingPanel";

function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const {
    game,
    player,
    loading,
    error,
    phase,
    hasSubmitted,
    isQuestionFinished,
    playerAnswerResult,
    previousLeaderboard,
    results,
    avatar,
    actions,
  } = useGameSession(gameId);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-white" />
          <p className="text-xl font-bold text-white">Loading game...</p>
        </div>
      </div>
    );

  if (error || !game)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-black text-[#E21B3C] mb-4">Error</h2>
          <p className="text-gray-600">{error || "Game not found"}</p>
        </div>
      </div>
    );

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8"
          style={{ animation: "bounce-in 0.6s ease-out" }}
        >
          <h2 className="text-2xl font-black text-center text-gray-800 mb-6">
            Join the Quiz
          </h2>
          <PlayerJoinForm onJoin={actions.join} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">

        <div
          className="text-center space-y-3 py-4 sm:py-6 px-4 sm:px-8 bg-white/15 backdrop-blur-sm rounded-3xl"
          style={{ animation: "slide-up 0.5s ease-out" }}
        >
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-black text-white"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
          >
            {game.name}
          </h1>
          <div className="flex items-center justify-center flex-wrap gap-3 sm:gap-6 text-sm sm:text-base font-bold">
            <div className="flex items-center space-x-2 text-white/90">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{game.players.length} players</span>
            </div>
            <div className="flex items-center space-x-2 text-white/90">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="capitalize px-2 sm:px-3 py-1 bg-white/20 rounded-full">
                {game.status}
              </span>
            </div>
          </div>
        </div>

        {game.status === GAME_STATUS.CANCELLED && <CancelledPanel />}

        {game.status === GAME_STATUS.WAITING && <WaitingPanel />}

        {game.status === GAME_STATUS.ACTIVE && phase === GAME_PHASE.QUESTION && (
          <AnswerPanel
            question={game.questions[game.currentQuestionIndex] ?? null}
            hasSubmitted={hasSubmitted}
            isQuestionFinished={isQuestionFinished}
            onAnswerSubmit={actions.submitAnswer}
          />
        )}

        {game.status === GAME_STATUS.ACTIVE && phase === GAME_PHASE.SHOWING_RESULT && (
          <ResultPanel
            hasSubmitted={hasSubmitted}
            isQuestionFinished={isQuestionFinished}
            playerAnswerResult={playerAnswerResult}
            avatarSeed={avatar.seed}
            accessories={avatar.accessories}
          />
        )}

        {game.status === GAME_STATUS.ACTIVE && phase === GAME_PHASE.SHOWING_SCOREBOARD && (
          <ScoreboardPanel
            players={game.players}
            previousLeaderboard={previousLeaderboard}
            currentPlayerId={player.id}
          />
        )}

        {game.status === GAME_STATUS.FINISHED && (
          <FinishedPanel gameId={gameId} results={results} />
        )}
      </div>
    </div>
  );
}

export default withErrorBoundary(GamePage);
