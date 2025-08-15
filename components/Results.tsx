"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Trophy, Users } from "lucide-react";
import type { GameResults } from "@/types";

interface ResultsProps {
  gameId: string;
}

export function Results({ gameId }: ResultsProps) {
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}/results`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results);
        }
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [gameId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-600 dark:text-gray-300">
            Loading results...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-600 dark:text-gray-300">
            No results available
          </p>
        </CardContent>
      </Card>
    );
  }

  const accuracy =
    results.totalPlayers > 0
      ? (results.leaderboard.reduce((acc, p) => acc + p.correctAnswers, 0) /
          (results.totalPlayers * results.totalQuestions)) *
        100
      : 0;

  return (
    <div className="space-y-6">
      {/* Overall Results */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Quiz Results</span>
          </CardTitle>
          <CardDescription>See how everyone performed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-center space-x-1 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  Total Players
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {results.totalPlayers}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center justify-center space-x-1 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  Correct Answers
                </span>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {results.leaderboard.reduce(
                  (acc, p) => acc + p.correctAnswers,
                  0
                )}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center justify-center space-x-1 mb-2">
                <Trophy className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-600 dark:text-purple-400">
                  Accuracy
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {accuracy.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Results */}
      <Card>
        <CardHeader>
          <CardTitle>Player Results</CardTitle>
          <CardDescription>Individual performance breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {results.leaderboard.map((player) => {
              const allCorrect =
                player.correctAnswers === results.totalQuestions;
              return (
                <div
                  key={player.playerId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {allCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default">Score: {player.score}</Badge>
                    <Badge variant={allCorrect ? "default" : "destructive"}>
                      {allCorrect
                        ? "All Correct"
                        : `${player.correctAnswers}/${results.totalQuestions} Correct`}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-300">Want to play again?</p>
        <div className="space-x-4">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
          >
            Create New Quiz
          </a>
          <a
            href="/join"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Join Another Game
          </a>
        </div>
      </div>
    </div>
  );
}
