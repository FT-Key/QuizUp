"use client"

import { JoinForm } from "@/components/JoinForm"
import { useMusicContextPublisher } from "@/hooks/useMusicContext"
import Link from "next/link"

export default function HomePage() {
  useMusicContextPublisher()
  return (
    <div className="min-h-dvh flex flex-col p-3 py-4 sm:p-4 sm:py-8">
      <div className="w-full max-w-md m-auto space-y-4 sm:space-y-8" style={{ animation: "slide-up 0.6s ease-out" }}>

        <div className="text-center space-y-2 sm:space-y-4">
          <div
            className="inline-block"
            style={{ animation: "bounce-in 0.8s ease-out" }}
          >
            <img
              src="/logo-quizup.png"
              alt="QuizUp!"
              className="h-20 sm:h-32 md:h-40 mx-auto drop-shadow-2xl"
            />
          </div>
          <p className="text-base sm:text-xl text-white/90 font-medium">
            Enter a game code and play with friends!
          </p>
        </div>

        <div
          className="bg-white rounded-3xl shadow-2xl p-5 sm:p-8"
          style={{ animation: "bounce-in 0.9s ease-out" }}
        >
          <JoinForm />
        </div>

        <div className="text-center">
          <Link
            href="/create"
            className="inline-flex items-center px-6 py-3 text-base font-semibold text-white rounded-full transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #864CBF 0%, #46178F 100%)",
              boxShadow: "0 4px 15px rgba(70, 23, 143, 0.4)"
            }}
          >
            Create a Quiz
          </Link>
        </div>
      </div>
    </div>
  )
}
