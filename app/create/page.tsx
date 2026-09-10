"use client"

import { GameForm } from "@/components/GameForm"

export default function CreatePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-3xl space-y-6" style={{ animation: "slide-up 0.6s ease-out" }}>
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 
            className="text-4xl font-black text-white tracking-tight"
            style={{ textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
          >
            Create Quiz
          </h1>
          <p className="text-lg text-white/90 font-medium">
            Build your quiz and challenge your friends!
          </p>
        </div>

        {/* Form Card */}
        <div 
          className="bg-white rounded-3xl shadow-2xl p-6 md:p-8"
          style={{ animation: "bounce-in 0.9s ease-out" }}
        >
          <GameForm />
        </div>

        {/* Back to Join */}
        <div className="text-center">
          <a
            href="/"
            className="inline-flex items-center px-6 py-3 text-base font-semibold text-white rounded-full transition-all hover:scale-105"
            style={{ 
              background: "linear-gradient(135deg, #1368CE 0%, #0D47A1 100%)",
              boxShadow: "0 4px 15px rgba(19, 104, 206, 0.4)"
            }}
          >
            Join a Quiz
          </a>
        </div>
      </div>
    </div>
  )
}
