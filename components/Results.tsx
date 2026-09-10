"use client";

import { useEffect, useState } from "react";
import { Trophy, Users, CheckCircle, XCircle } from "lucide-react";
import type { GameResults } from "@/types";

interface ResultsProps {
  gameId: string;
  results?: GameResults | null;
}

export function Results({ gameId, results: resultsProp }: ResultsProps) {
  const [fetchedResults, setFetchedResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(!resultsProp);

  useEffect(() => {
    if (resultsProp) {
      setFetchedResults(resultsProp);
      setLoading(false);
      return;
    }
    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}/results`);
        if (response.ok) {
          const data = await response.json();
          setFetchedResults(data.results);
        }
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [gameId, resultsProp]);

  const results = resultsProp || fetchedResults;

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
        <p className="text-lg font-bold text-gray-600">Loading results...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
        <p className="text-lg font-bold text-gray-600">No results available</p>
      </div>
    );
  }

  const accuracy =
    results.totalPlayers > 0
      ? (results.leaderboard.reduce((acc, p) => acc + p.correctAnswers, 0) /
          (results.totalPlayers * results.totalQuestions)) *
        100
      : 0;

  return (
    <div className="space-y-6" style={{ animation: "bounce-in 0.6s ease-out" }}>
      {/* Trophy Header */}
      <div className="text-center py-6 bg-white/15 backdrop-blur-sm rounded-3xl">
        <div className="text-6xl mb-3">🏆</div>
        <h2 className="text-3xl font-black text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
          Quiz Results
        </h2>
        <p className="text-white/80 font-medium mt-1">See how everyone performed</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 text-center shadow-lg">
          <div className="flex items-center justify-center mb-2">
            <Users className="h-6 w-6 text-[#1368CE]" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">Players</p>
          <p className="text-3xl font-black text-[#1368CE]">{results.totalPlayers}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 text-center shadow-lg">
          <div className="flex items-center justify-center mb-2">
            <CheckCircle className="h-6 w-6 text-[#26890C]" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">Correct</p>
          <p className="text-3xl font-black text-[#26890C]">
            {results.leaderboard.reduce((acc, p) => acc + p.correctAnswers, 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 text-center shadow-lg">
          <div className="flex items-center justify-center mb-2">
            <Trophy className="h-6 w-6 text-[#FFC900]" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">Accuracy</p>
          <p className="text-3xl font-black text-[#864CBF]">{accuracy.toFixed(0)}%</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-3xl shadow-xl p-6">
        <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
          <span>🏅</span> Leaderboard
        </h3>
        <div className="space-y-3">
          {results.leaderboard.map((player, index) => {
            const allCorrect = player.correctAnswers === results.totalQuestions;
            return (
              <div
                key={player.playerId}
                className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                  index === 0
                    ? "bg-gradient-to-r from-[#FFC900]/20 to-[#FFC900]/10 border-2 border-[#FFC900]/50"
                    : "bg-gray-50 border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                      index === 0 
                        ? "bg-[#FFC900] text-white" 
                        : index === 1 
                          ? "bg-gray-300 text-gray-700" 
                          : index === 2 
                            ? "bg-[#CD7F32] text-white" 
                            : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {index + 1}
                  </div>
                  {/* Name + status */}
                  <div>
                    <span className="font-bold text-gray-800">{player.name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {allCorrect ? (
                        <span className="text-xs font-bold text-[#26890C] flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> All Correct
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-gray-500">
                          {player.correctAnswers}/{results.totalQuestions} correct
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#864CBF]">{player.score}</span>
                  <span className="text-xs font-bold text-gray-400 block">pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="text-center space-y-4 pb-4">
        <p className="text-white/80 font-medium">Want to play again?</p>
        <div className="flex justify-center gap-4">
          <a
            href="/create"
            className="inline-flex items-center px-6 py-3 text-base font-bold text-white rounded-full transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #864CBF 0%, #46178F 100%)",
              boxShadow: "0 4px 15px rgba(70, 23, 143, 0.4)",
            }}
          >
            Create New Quiz
          </a>
          <a
            href="/"
            className="inline-flex items-center px-6 py-3 text-base font-bold text-white rounded-full transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
              boxShadow: "0 4px 15px rgba(19, 104, 206, 0.4)",
            }}
          >
            Join Another Game
          </a>
        </div>
      </div>
    </div>
  );
}
