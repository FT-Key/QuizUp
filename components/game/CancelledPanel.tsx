"use client";

import Link from "next/link";

export function CancelledPanel() {
  return (
    <div
      className="bg-white rounded-3xl shadow-xl p-8 text-center"
      style={{ animation: "bounce-in 0.6s ease-out" }}
    >
      <div className="text-5xl mb-4">🚪</div>
      <p className="text-xl font-bold text-gray-800">
        El anfitrión cerró la partida
      </p>
      <p className="text-gray-500 mt-2">Esta partida nunca se inició.</p>
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
  );
}
