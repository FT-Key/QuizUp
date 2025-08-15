"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle, XCircle } from "lucide-react";
import type { Player, Question } from "@/types";

interface PlayerListProps {
  players: Player[];
  gameStatus: "waiting" | "active" | "finished";
  currentQuestion?: Question; // pregunta actual, para mostrar respuestas correctas
}

export function PlayerList({
  players,
  gameStatus,
  currentQuestion,
}: PlayerListProps) {
  if (players.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Players</span>
          </CardTitle>
          <CardDescription>Players who have joined the game</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No players have joined yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Share the game ID for others to join
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Players ({players.length})</span>
        </CardTitle>
        <CardDescription>Players who have joined the game</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {players.map((player, index) => {
            const currentAnswer = currentQuestion
              ? player.answers[currentQuestion.id]
              : undefined;
            const isCorrect = currentQuestion
              ? currentAnswer === currentQuestion.correctAnswer
              : undefined;

            return (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                {/* Información del jugador */}
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{player.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Joined {new Date(player.joinedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Estado y respuestas */}
                <div className="flex items-center space-x-2">
                  {gameStatus === "waiting" && (
                    <Badge
                      variant="secondary"
                      className="flex items-center space-x-1"
                    >
                      <Clock className="h-3 w-3" />
                      <span>Waiting</span>
                    </Badge>
                  )}

                  {gameStatus === "active" && (
                    <Badge
                      variant={
                        currentAnswer !== undefined ? "default" : "secondary"
                      }
                      className="flex items-center space-x-1"
                    >
                      {currentAnswer !== undefined ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          <span>Answered</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          <span>Thinking...</span>
                        </>
                      )}
                    </Badge>
                  )}

                  {gameStatus === "finished" && (
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        Answer:{" "}
                        {currentAnswer !== undefined
                          ? String.fromCharCode(65 + currentAnswer)
                          : "No answer"}
                      </Badge>
                      {isCorrect !== undefined && (
                        <Badge
                          variant={isCorrect ? "default" : "destructive"}
                          className="flex items-center space-x-1"
                        >
                          {isCorrect ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              <span>Correct</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" />
                              <span>Incorrect</span>
                            </>
                          )}
                        </Badge>
                      )}
                      {/* Puntaje total */}
                      <Badge variant="secondary">Score: {player.score}</Badge>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
