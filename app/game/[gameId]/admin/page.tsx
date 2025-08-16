"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PlayerList } from "@/components/PlayerList";
import { Results } from "@/components/Results";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Users,
  Play,
  Square,
  Copy,
  Check,
  Settings,
} from "lucide-react";
import type { Game, GameState } from "@/types";
import { initSocket } from "@/lib/socket";

export default function AdminPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // ---- fetch inicial
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) throw new Error("Game not found");
        const data = await response.json();
        setGame(data.game);
      } catch (error) {
        console.error("Error fetching game:", error);
        setError("Failed to load game");
      } finally {
        setLoading(false);
      }
    };

    if (gameId) fetchGame();
  }, [gameId]);

  // ---- socket realtime
  useEffect(() => {
    if (!gameId) return;

    const socket = initSocket();

    // Unirse como admin
    socket.emit("join-admin", gameId);

    // --- Listeners ---
    const handlePlayerJoined = ({ player }: { player: any }) => {
      console.log("player-joined received:", player);
      setGame((prev) => {
        if (!prev) return prev;
        if (prev.players.some((p) => p.id === player.id)) return prev;
        return { ...prev, players: [...prev.players, player] };
      });
    };

    const handleGameUpdated = (state: GameState) => {
      setGame({ ...state.game });
    };

    const handleGameFinished = ({ results }: { results: any }) => {
      setGame((prev) => (prev ? { ...prev, status: "finished" } : null));
    };

    socket.on("player-joined", handlePlayerJoined);
    socket.on("game-updated", handleGameUpdated);
    socket.on("game-finished", handleGameFinished);

    // --- Cleanup
    return () => {
      socket.off("player-joined", handlePlayerJoined);
      socket.off("game-updated", handleGameUpdated);
      socket.off("game-finished", handleGameFinished);
      // NO desconectamos el socket aquí, así evita el warning
    };
  }, [gameId]);

  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      const socket = initSocket();
      socket.emit("start-game", { gameId });
      await fetch(`/api/games/${gameId}/start`, { method: "POST" });
    } catch (error) {
      console.error(error);
      alert("Failed to start game. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinishGame = async () => {
    setIsFinishing(true);
    try {
      const socket = initSocket();
      socket.emit("finish-game", { gameId });
      await fetch(`/api/games/${gameId}/finish`, { method: "POST" });
    } catch (error) {
      console.error(error);
      alert("Failed to finish game. Please try again.");
    } finally {
      setIsFinishing(false);
    }
  };

  const copyGameId = async () => {
    try {
      await navigator.clipboard.writeText(gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-300">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-300">
              {error || "Game not found"}
            </p>
            <div className="mt-4 text-center">
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
              >
                Back to Home
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = game.questions[game.currentQuestionIndex];
  const playersWithAnswers = game.players.filter(
    (p) => p.answers?.[currentQuestion.id] !== undefined
  ).length;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
          </div>
          <h2 className="text-xl text-gray-600 dark:text-gray-300">
            {game.name}
          </h2>
        </div>

        {/* Game Info & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Game Info */}
          <Card>
            <CardHeader>
              <CardTitle>Game Information</CardTitle>
              <CardDescription>Current game status and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Game ID:
                </span>
                <div className="flex items-center space-x-2">
                  <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                    {gameId}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyGameId}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Status:
                </span>
                <Badge
                  variant={
                    game.status === "waiting"
                      ? "secondary"
                      : game.status === "active"
                      ? "default"
                      : "outline"
                  }
                >
                  {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Players:
                </span>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{game.players.length}</span>
                </div>
              </div>
              {game.status === "active" && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">
                    Answers Submitted:
                  </span>
                  <span className="font-medium">
                    {playersWithAnswers} / {game.players.length}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Game Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Game Controls</CardTitle>
              <CardDescription>Manage your quiz session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {game.status === "waiting" && (
                <Button
                  onClick={handleStartGame}
                  disabled={isStarting || game.players.length === 0}
                  className="w-full"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting Game...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Game
                    </>
                  )}
                </Button>
              )}

              {game.status === "active" && (
                <Button
                  onClick={handleFinishGame}
                  disabled={isFinishing}
                  variant="destructive"
                  className="w-full"
                >
                  {isFinishing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finishing Game...
                    </>
                  ) : (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      Finish Game
                    </>
                  )}
                </Button>
              )}

              {game.status === "finished" && (
                <div className="text-center space-y-2">
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    Game Completed!
                  </p>
                  <a
                    href="/"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    Create New Game
                  </a>
                </div>
              )}

              {game.players.length === 0 && game.status === "waiting" && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Waiting for players to join...
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Question Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Question Preview</CardTitle>
            <CardDescription>The question players will answer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium text-lg">{currentQuestion.text}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentQuestion.options.map((option, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      index === currentQuestion.correctAnswer
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {index === currentQuestion.correctAnswer && (
                        <Badge variant="default" className="ml-auto">
                          Correct
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Players List */}
        <PlayerList players={game.players} gameStatus={game.status} />

        {/* Results */}
        {game.status === "finished" && <Results gameId={gameId} />}
      </div>
    </div>
  );
}
