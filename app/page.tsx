"use client"

import { JoinForm } from "@/components/JoinForm"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8" style={{ animation: "slide-up 0.6s ease-out" }}>
        {/* Logo */}
        <div className="text-center space-y-4">
          <div 
            className="inline-block"
            style={{ animation: "bounce-in 0.8s ease-out" }}
          >
            <img 
              src="/logo-quizup.png" 
              alt="QuizUp!" 
              className="h-32 md:h-40 mx-auto drop-shadow-2xl"
            />
          </div>
          <p className="text-xl text-white/90 font-medium">
            Enter a game code and play with friends!
          </p>
        </div>

        {/* Join Form Card */}
        <div 
          className="bg-white rounded-3xl shadow-2xl p-8"
          style={{ animation: "bounce-in 0.9s ease-out" }}
        >
          <JoinForm />
        </div>

        {/* Create Quiz Link */}
        <div className="text-center">
          <a
            href="/create"
            className="inline-flex items-center px-6 py-3 text-base font-semibold text-white rounded-full transition-all hover:scale-105"
            style={{ 
              background: "linear-gradient(135deg, #864CBF 0%, #46178F 100%)",
              boxShadow: "0 4px 15px rgba(70, 23, 143, 0.4)"
            }}
          >
            Create a Quiz
          </a>
        </div>
      </div>
    </div>
  )
}
