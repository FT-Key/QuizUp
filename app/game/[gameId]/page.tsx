"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QuestionCard } from "@/components/QuestionCard";
import { Results } from "@/components/Results";
import { Avatar } from "@/components/Avatar";
import { AvatarSelector } from "@/components/AvatarSelector";
import { Scoreboard } from "@/components/Scoreboard";
import { Loader2, Users, Clock } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { usePlayerSession } from "@/hooks/usePlayerSession";
import type { Game, Player, GameResults, Question, PlayerAvatar } from "@/types";

type GamePhase = 'waiting' | 'question' | 'showing-result' | 'showing-scoreboard';

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const session = usePlayerSession();

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState<GameResults | null>(null);
  const [isQuestionFinished, setIsQuestionFinished] = useState(false);
  const [playerAnswerResult, setPlayerAnswerResult] = useState<{
    correct: boolean;
    score: number;
  } | null>(null);

  
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [playerAvatarSeed, setPlayerAvatarSeed] = useState<string>("");
  const [playerAccessories, setPlayerAccessories] = useState<string[]>([]);
  const [previousLeaderboard, setPreviousLeaderboard] = useState<Array<{playerId: string; score: number}>>([]);

  const prevQuestionIndexRef = useRef<number | null>(null);

  
  
  const syncPhaseFromGame = (g: Game, me: Player | null | undefined) => {
    if (g.status !== "active") return;

    const q = g.questions[g.currentQuestionIndex];
    if (!q) return;

    const answered = me?.answers?.[q.id] !== undefined;
    const allAnswered =
      g.players.length > 0 &&
      g.players.every((p) => p.answers?.[q.id] !== undefined);
    const timeExpired =
      g.currentQuestionStartTime === 0 ||
      (g.currentQuestionStartTime > 0 &&
        Date.now() >=
          g.currentQuestionStartTime + (g.questionTimeLimit || 30000));
    const questionFinished = allAnswered || timeExpired;

    setHasSubmitted(answered);
    setIsQuestionFinished(questionFinished);

    if (answered && me) {
      setPlayerAnswerResult({
        correct: me.answers[q.id] === q.correctAnswer,
        score: me.score || 0,
      });
    } else {
      setPlayerAnswerResult(null);
    }

    setGamePhase(questionFinished ? "showing-result" : "question");
  };

  
  useEffect(() => {
    if (gamePhase === 'showing-result') {
      const timer = setTimeout(() => {
        setGamePhase('showing-scoreboard');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [gamePhase]);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        if (!res.ok) throw new Error("Game not found");
        const data = await res.json();
        setGame(data.game);

        const playerId = session.get("playerId");
        const playerName = session.get("playerName");
        const avatarSeed = session.get("playerAvatarSeed");
        if (avatarSeed) setPlayerAvatarSeed(avatarSeed);
        setPlayerAccessories(session.getAccessories());

        if (playerId && playerName) {
          const foundPlayer = data.game.players.find(
            (p: Player) => p.id === playerId
          );
          if (foundPlayer) {
            if (!foundPlayer.answers) foundPlayer.answers = {};
            setPlayer(foundPlayer);
            emit("join-game", {
              gameId,
              playerId,
              avatar: {
                seed: avatarSeed || playerName,
                accessories: session.getAccessories().filter((a) => a !== 'none'),
              },
            });

            const currentQuestion =
              data.game.questions[data.game.currentQuestionIndex];
            if (currentQuestion) {
              setHasSubmitted(
                foundPlayer.answers?.[currentQuestion.id] !== undefined
              );
            }
            
            syncPhaseFromGame(data.game, foundPlayer);
          }
        }
      } catch (err) {
        
        setError("Failed to load game");
      } finally {
        setLoading(false);
      }
    };

    if (gameId) fetchGame();
  }, [gameId]);

  const emitRef = useRef<((event: string, data?: any) => void) | null>(null);
  const { emit } = useSocket({
    gameId,
    events: useMemo(
      () => [
        {
          event: "joined",
          callback: (data: { player: Player; game: Game }) => {
            
            if (data.player) {
              session.set("playerId", data.player.id);
              session.set("playerName", data.player.name);
              setPlayer(data.player);
              if (data.player.avatar?.seed) {
                setPlayerAvatarSeed(data.player.avatar.seed);
              }
              if (data.player.avatar?.accessories) {
                setPlayerAccessories(data.player.avatar.accessories);
              }
            }
            if (data.game) {
              setGame(data.game);
              const curQ = data.game.questions[data.game.currentQuestionIndex];
              if (data.player && curQ) {
                setHasSubmitted(
                  Boolean(
                    data.player.answers &&
                      data.player.answers[curQ.id] !== undefined
                  )
                );
              }
              syncPhaseFromGame(data.game, data.player);
            }
            setLoading(false);
          },
        },
        {
          event: "game-started",
          callback: (data: {
            game: Game;
            players: Player[];
            currentQuestion: Question;
          }) => {
            
            setIsQuestionFinished(false);
            setHasSubmitted(false);
            setPlayerAnswerResult(null);
            setGame(data.game);
            setGamePhase('question');

            
            const lb = data.game.players.map(p => ({ playerId: p.id, score: p.score }));
            setPreviousLeaderboard(lb);

            const pid = session.get("playerId");
            if (pid) {
              const found = data.game.players.find((p) => p.id === pid);
              if (found) setPlayer(found);
            }
          },
        },
        {
          event: "game-updated",
          callback: (payload: { game: Game }) => {
            
            const updatedGame = payload.game;
            setGame(updatedGame);

            const pid = session.get("playerId");
            if (pid) {
              const found = updatedGame.players.find((p) => p.id === pid);
              if (found) {
                setPlayer(found);
                const curQ =
                  updatedGame.questions[updatedGame.currentQuestionIndex];
                if (curQ) {
                  const hasAnswer = found.answers && found.answers[curQ.id] !== undefined;
                  
                  setHasSubmitted(Boolean(hasAnswer));
                }
              }
            }

            const curQ = updatedGame.questions[updatedGame.currentQuestionIndex];
            if (curQ) {
              const allAnswered = updatedGame.players.every(
                (p) => p.answers?.[curQ.id] !== undefined
              );
              
              setIsQuestionFinished(allAnswered);
              if (allAnswered) {
                const pid2 = session.get("playerId");
                if (pid2) {
                  const me = updatedGame.players.find((p) => p.id === pid2);
                  if (me) {
                    const playerAns = me.answers?.[curQ.id];
                    
                    if (playerAns !== undefined) {
                      setPlayerAnswerResult({
                        correct: playerAns === curQ.correctAnswer,
                        score: me.score || 0,
                      });
                    }
                  }
                }
              }
            }

            prevQuestionIndexRef.current = updatedGame.currentQuestionIndex;
          },
        },
        {
          event: "question-finished",
          callback: (data: any) => {
            
            setIsQuestionFinished(true);
            setGamePhase('showing-result');
            emitRef.current?.("request-game-state", { gameId });
          },
        },
        {
          event: "game-state",
          callback: (payload: {
            game: Game;
            currentQuestion: Question | null;
            currentQuestionIndex: number;
            timeLeft: number;
          }) => {
            
            setGame(payload.game);
            const pid = session.get("playerId");
            if (pid) {
              const found = payload.game.players.find((p) => p.id === pid);
              if (found) {
                setPlayer(found);
                syncPhaseFromGame(payload.game, found);
              }
            }
          },
        },
        {
          event: "join-error",
          callback: (payload: any) => {
            
            alert(payload?.message || "Failed to join the game");
          },
        },
        {
          event: "game-finished",
          callback: (data: { game: Game; results: GameResults }) => {
            
            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) => (prev ? { ...prev, status: "finished" } : prev));
            }
            if (data.results) {
              setResults(data.results);
            }
          },
        },
        {
          event: "game-cancelled",
          callback: (data: { game: Game }) => {
            
            if (data.game) {
              setGame(data.game);
            } else {
              setGame((prev) =>
                prev ? { ...prev, status: "cancelled" } : prev
              );
            }
          },
        },
        {
          event: "question-changed",
          callback: (data: { question: Question; questionIndex: number; timeLeft: number }) => {
            
            setIsQuestionFinished(false);
            setHasSubmitted(false);
            setPlayerAnswerResult(null);
            setGamePhase('question');
            setGame((prev) => {
              if (!prev) return prev;
              return { ...prev, currentQuestionIndex: data.questionIndex };
            });
          },
        },
      ],
      [gameId]
    ),
  });

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  function JoinForm() {
    const session = usePlayerSession();
    const [name, setName] = useState<string>(() => {
      return session.get("playerName") ?? "";
    });
    const [avatarSeed, setAvatarSeed] = useState<string>("");
    const [avatarAccessories, setAvatarAccessories] = useState<string[]>([]);
    const [joinStep, setJoinStep] = useState<'name' | 'avatar'>('name');

    const handleNameSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;
      setJoinStep('avatar');
    };

    const handleJoin = () => {
      if (!emit) return;
      const trimmed = name.trim();
      session.set("playerName", trimmed);
      if (avatarSeed) session.set("playerAvatarSeed", avatarSeed);
      if (avatarAccessories.length > 0) {
        session.setAccessories(avatarAccessories);
      }
      emit("join-game", {
        gameId,
        playerName: trimmed,
        avatar: {
          seed: avatarSeed || trimmed,
          accessories: avatarAccessories.filter(a => a !== 'none'),
        },
      });
    };

    if (joinStep === 'avatar') {
      return (
        <div className="space-y-4">
          <AvatarSelector
            playerName={name}
            onSelect={(seed, accessories) => {
              setAvatarSeed(seed);
              if (accessories) setAvatarAccessories(accessories);
            }}
            initialSeed={avatarSeed || name}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setJoinStep('name')}
              className="px-6 py-4 text-lg font-bold text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #666 0%, #444 100%)",
              }}
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={handleJoin}
              className="flex-1 py-4 text-lg font-black text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              style={{
                background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
                boxShadow: "0 6px 20px rgba(19, 104, 206, 0.4)",
              }}
            >
              JOIN GAME
            </button>
          </div>
        </div>
      );
    }

    return (
      <form onSubmit={handleNameSubmit} className="space-y-4">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Your Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 text-lg font-medium border-3 border-white/30 rounded-2xl bg-white/20 text-white placeholder-white/60 focus:border-white focus:ring-4 focus:ring-white/30 transition-all outline-none"
          style={{ borderWidth: "3px" }}
          placeholder="Enter a display name..."
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full py-4 text-lg font-black text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style={{
            background: name.trim()
              ? "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)"
              : "linear-gradient(135deg, #666 0%, #444 100%)",
            boxShadow: name.trim() ? "0 6px 20px rgba(19, 104, 206, 0.4)" : "none",
          }}
        >
          SIGUIENTE
        </button>
      </form>
    );
  }

  const handleAnswerSubmit = (answerIndex: number) => {
    if (!player || !game) return;
    const currentQuestion = game.questions[game.currentQuestionIndex];
    if (!currentQuestion) return;

    emit("submit-answer", {
      gameId,
      playerId: player.id,
      questionId: currentQuestion.id,
      answer: answerIndex,
    });

    setPlayer((prev) =>
      prev
        ? {
            ...prev,
            answers: { ...prev.answers, [currentQuestion.id]: answerIndex },
          }
        : prev
    );
    setHasSubmitted(true);

    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    setPlayerAnswerResult({
      correct: isCorrect,
      score: player.score || 0,
    });
  };

  
  const buildLeaderboardEntries = useCallback(() => {
    if (!game) return [];
    return game.players.map((p, idx) => {
      const prevIdx = previousLeaderboard.findIndex(pl => pl.playerId === p.id);
      return {
        playerId: p.id,
        name: p.name,
        score: p.score,
        previousPosition: prevIdx >= 0 ? prevIdx : idx,
        currentPosition: idx,
        avatar: p.avatar,
      };
    }).sort((a, b) => b.score - a.score).map((entry, idx) => ({
      ...entry,
      currentPosition: idx,
    }));
  }, [game, previousLeaderboard]);

  const currentAvatarSeed = playerAvatarSeed || player?.name || "";

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
          <JoinForm />
        </div>
      </div>
    );
  }

  const currentQuestion = game.questions[game.currentQuestionIndex];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div 
          className="text-center space-y-3 py-4 sm:py-6 px-4 sm:px-8 bg-white/15 backdrop-blur-sm rounded-3xl"
          style={{ animation: "slide-up 0.5s ease-out" }}
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
            {game.name}
          </h1>
          <div className="flex items-center justify-center flex-wrap gap-3 sm:gap-6 text-sm sm:text-base font-bold">
            <div className="flex items-center space-x-2 text-white/90">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{game.players.length} players</span>
            </div>
            <div className="flex items-center space-x-2 text-white/90">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="capitalize px-2 sm:px-3 py-1 bg-white/20 rounded-full">{game.status}</span>
            </div>
          </div>
        </div>

        
        {game.status === "cancelled" && (
          <div
            className="bg-white rounded-3xl shadow-xl p-8 text-center"
            style={{ animation: "bounce-in 0.6s ease-out" }}
          >
            <div className="text-5xl mb-4">🚪</div>
            <p className="text-xl font-bold text-gray-800">
              El anfitrión cerró la partida
            </p>
            <p className="text-gray-500 mt-2">
              Esta partida nunca se inició.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center mt-6 px-6 py-3 text-base font-bold text-white rounded-full transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
              }}
            >
              Volver al inicio
            </Link>
          </div>
        )}

        
        {game.status === "waiting" && (
          <div 
            className="bg-white rounded-3xl shadow-xl p-8 text-center"
            style={{ animation: "bounce-in 0.6s ease-out" }}
          >
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-xl font-bold text-gray-800">
              Waiting for the game to start...
            </p>
            <p className="text-gray-500 mt-2">The host will start the quiz soon</p>
          </div>
        )}

        
        {game.status === "active" &&
          gamePhase === 'question' &&
          !isQuestionFinished &&
          !hasSubmitted &&
          currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              onAnswerSubmit={handleAnswerSubmit}
            />
          )}

        
        {game.status === "active" &&
          gamePhase === 'question' &&
          hasSubmitted && (
            <div
              className="bg-white rounded-3xl shadow-xl p-8 text-center"
              style={{ animation: "bounce-in 0.4s ease-out" }}
            >
              <div className="text-5xl mb-4">✅</div>
              <p className="text-xl font-bold text-gray-800">
                ¡Respuesta enviada!
              </p>
              <p className="text-gray-500 mt-2">
                Esperando a los demás jugadores...
              </p>
            </div>
          )}

        
        {game.status === "active" &&
          gamePhase === 'showing-result' &&
          hasSubmitted &&
          playerAnswerResult && (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="animate-avatar-pop">
                <Avatar
                  seed={currentAvatarSeed}
                  size={120}
                  expression={playerAnswerResult.correct ? 'happy' : 'sad'}
                  accessories={playerAccessories}
                />
              </div>
              {playerAnswerResult.correct ? (
                <div className="animate-slide-in-up">
                  <p className="text-green-400 text-2xl font-black">✅ ¡Correcto!</p>
                  <p className="text-white text-lg">+{playerAnswerResult.score} puntos</p>
                </div>
              ) : (
                <div className="animate-slide-in-up">
                  <p className="text-red-400 text-2xl font-black">❌ Incorrecto</p>
                  <p className="text-white/70">Mejor suerte la próxima vez</p>
                </div>
              )}
            </div>
          )}

        
        {game.status === "active" &&
          gamePhase === 'showing-result' &&
          isQuestionFinished &&
          !playerAnswerResult && (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="animate-avatar-pop">
                <Avatar
                  seed={currentAvatarSeed}
                  size={120}
                  expression="sad"
                  accessories={playerAccessories}
                />
              </div>
              <div className="animate-slide-in-up">
                <p className="text-yellow-400 text-2xl font-black">⏰ ¡Tiempo!</p>
                <p className="text-white/70">No enviaste respuesta</p>
              </div>
            </div>
          )}

        
        {game.status === "active" &&
          gamePhase === 'showing-scoreboard' && (
            <Scoreboard
              entries={buildLeaderboardEntries()}
              currentPlayerId={player.id}
            />
          )}

        
        {game.status === "finished" && (
          <Results gameId={gameId} results={results} />
        )}
      </div>
    </div>
  );
}
