"use client";

import { TIME_LIMIT_OPTIONS } from "@/constants/game";

interface TimeLimitSelectorProps {
  value: number;
  onChange: (ms: number) => void;
}

export function TimeLimitSelector({ value, onChange }: TimeLimitSelectorProps) {
  return (
    <div className="flex bg-gray-100 rounded-2xl p-1">
      {TIME_LIMIT_OPTIONS.map((time, i) => {
        const isSelected = value === time;
        return (
          <button
            key={time}
            type="button"
            onClick={() => onChange(time)}
            className={`flex-1 py-3 text-base font-bold transition-all ${
              isSelected
                ? "bg-white text-[#46178F] shadow-md"
                : "text-gray-500 hover:text-gray-700"
            } ${
              i === 0
                ? "rounded-l-xl"
                : i === 2
                ? "rounded-r-xl"
                : ""
            }`}
          >
            {time / 1000}s
          </button>
        );
      })}
    </div>
  );
}
