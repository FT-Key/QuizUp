"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Gamepad2, User } from "lucide-react"
import type { JoinGameData } from "@/types"

export function JoinForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState<JoinGameData>({
    gameId: "",
    playerName: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/games/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to join game")
      }

      localStorage.setItem("playerId", data.player.id)
      localStorage.setItem("playerName", data.player.name)

      router.push(`/game/${formData.gameId}`)
    } catch (error) {
      console.error("Error joining game:", error)
      setError(error instanceof Error ? error.message : "Failed to join game. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = formData.gameId.trim() && formData.playerName.trim()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Game ID Input */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
          Game Code
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <Gamepad2 className="h-6 w-6 text-[#864CBF]" />
          </div>
          <input
            id="gameId"
            type="text"
            placeholder="Enter game code..."
            value={formData.gameId}
            onChange={(e) => setFormData({ ...formData, gameId: e.target.value.trim() })}
            className="w-full pl-14 pr-4 py-4 text-xl font-bold text-center uppercase tracking-widest border-3 border-gray-200 rounded-2xl focus:border-[#864CBF] focus:ring-4 focus:ring-[#864CBF]/20 transition-all outline-none"
            style={{ borderWidth: "3px" }}
            required
          />
        </div>
      </div>

      {/* Player Name Input */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
          Your Name
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <User className="h-6 w-6 text-[#1368CE]" />
          </div>
          <input
            id="playerName"
            type="text"
            placeholder="Enter your name..."
            value={formData.playerName}
            onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
            className="w-full pl-14 pr-4 py-4 text-lg font-medium border-3 border-gray-200 rounded-2xl focus:border-[#1368CE] focus:ring-4 focus:ring-[#1368CE]/20 transition-all outline-none"
            style={{ borderWidth: "3px" }}
            required
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 text-sm font-medium text-white bg-[#E21B3C] rounded-2xl text-center">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isFormValid || isLoading}
        className="w-full py-5 text-xl font-black text-white rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        style={{
          background: isFormValid 
            ? "linear-gradient(135deg, #26890C 0%, #1E7D0A 100%)" 
            : "linear-gradient(135deg, #A0A0A0 0%, #808080 100%)",
          boxShadow: isFormValid 
            ? "0 6px 20px rgba(38, 137, 12, 0.4)" 
            : "none"
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            Joining...
          </span>
        ) : (
          "JOIN GAME"
        )}
      </button>
    </form>
  )
}
