"use client";

export function WaitingPanel() {
  return (
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
  );
}
