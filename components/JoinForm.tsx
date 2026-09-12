"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Gamepad2, User, ArrowRight } from "lucide-react"
import { AvatarSelector } from "./AvatarSelector"
import { usePlayerSession } from "@/hooks/usePlayerSession"
import type { JoinGameData } from "@/types"

export function JoinForm() {
  const router = useRouter()
  const session = usePlayerSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<'name' | 'avatar'>('name')
  // El estado local siempre inicializa `playerName`: la opcionalidad del evento
  // no aplica al formulario (invariante local declarada, sin cambio de runtime).
  const [formData, setFormData] = useState<JoinGameData & { playerName: string }>({
    gameId: "",
    playerName: "",
  })
  const [avatarSeed, setAvatarSeed] = useState<string>("")
  const [avatarAccessories, setAvatarAccessories] = useState<string[]>([])

  const handleAvatarSelect = (seed: string, accessories?: string[]) => {
    setAvatarSeed(seed)
    if (accessories) setAvatarAccessories(accessories)
  }

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
        body: JSON.stringify({
          ...formData,
          avatar: {
            seed: avatarSeed || formData.playerName,
            accessories: avatarAccessories.filter(a => a !== 'none'),
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to join game")
      }

      session.set("playerId", data.player.id)
      session.set("playerName", data.player.name)
      if (avatarSeed) {
        session.set("playerAvatarSeed", avatarSeed)
      }
      if (avatarAccessories.length > 0) {
        session.setAccessories(avatarAccessories)
      }

      router.push(`/game/${formData.gameId}`)
    } catch (error) {

      setError(error instanceof Error ? error.message : "Failed to join game. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const isNameValid = formData.gameId.trim() && formData.playerName.trim()

  if (step === 'avatar') {
    return (
      <div className="space-y-6">
        <AvatarSelector
          playerName={formData.playerName}
          onSelect={handleAvatarSelect}
          initialSeed={avatarSeed || formData.playerName}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep('name')}
            className="px-6 py-4 text-lg font-bold text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #666 0%, #444 100%)",
            }}
          >
            Atrás
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-5 text-xl font-black text-white rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            style={{
              background: "linear-gradient(135deg, #26890C 0%, #1E7D0A 100%)",
              boxShadow: "0 6px 20px rgba(38, 137, 12, 0.4)",
            }}
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <span>UNIRSE</span>
                <ArrowRight className="h-6 w-6" />
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (isNameValid) setStep('avatar'); }} className="space-y-6">

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
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={formData.gameId}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
              setFormData({ ...formData, gameId: val });
            }}
            className="w-full pl-12 sm:pl-14 pr-3 sm:pr-4 py-4 text-2xl sm:text-3xl font-black text-center tracking-[0.2em] sm:tracking-[0.3em] border-3 border-gray-200 rounded-2xl focus:border-[#864CBF] focus:ring-4 focus:ring-[#864CBF]/20 transition-all outline-none"
            style={{ borderWidth: "3px" }}
            required
          />
        </div>
      </div>

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

      {error && (
        <div className="p-4 text-sm font-medium text-white bg-[#E21B3C] rounded-2xl text-center">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isNameValid}
        className="w-full py-5 text-xl font-black text-white rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
        style={{
          background: isNameValid
            ? "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)"
            : "linear-gradient(135deg, #A0A0A0 0%, #808080 100%)",
          boxShadow: isNameValid
            ? "0 6px 20px rgba(19, 104, 206, 0.4)"
            : "none"
        }}
      >
        <span>SELECCIONAR AVATAR</span>
        <ArrowRight className="h-6 w-6" />
      </button>
    </form>
  )
}
