"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Users } from "lucide-react"
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

      // Store player info in localStorage for the game session
      localStorage.setItem("playerId", data.player.id)
      localStorage.setItem("playerName", data.player.name)

      // Redirect to game page
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
      {/* Game ID */}
      <div className="space-y-2">
        <Label htmlFor="gameId">Game ID</Label>
        <Input
          id="gameId"
          type="text"
          placeholder="Enter the game ID..."
          value={formData.gameId}
          onChange={(e) => setFormData({ ...formData, gameId: e.target.value.trim() })}
          required
        />
      </div>

      {/* Player Name */}
      <div className="space-y-2">
        <Label htmlFor="playerName">Your Name</Label>
        <div className="relative">
          <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            id="playerName"
            type="text"
            placeholder="Enter your name..."
            value={formData.playerName}
            onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
            className="pl-10"
            required
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Joining Game...
          </>
        ) : (
          "Join Game"
        )}
      </Button>
    </form>
  )
}
