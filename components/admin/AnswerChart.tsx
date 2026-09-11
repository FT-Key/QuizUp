"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const OPTION_COLORS = ["#E21B3C", "#1368CE", "#FFC900", "#26890C"];
const LETTERS = ["A", "B", "C", "D"];

interface AnswerChartProps {
  options: string[];
  counts: number[];
  correctIndex: number;
}

export function AnswerChart({ options, counts, correctIndex }: AnswerChartProps) {
  const data = options.map((option, index) => ({
    name: LETTERS[index],
    count: counts[index] ?? 0,
    color: OPTION_COLORS[index] ?? "#9CA3AF",
    text: option,
    correct: index === correctIndex,
  }));

  const total = counts.reduce((acc, c) => acc + c, 0);

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-4 md:p-6">
      <h3 className="text-lg md:text-2xl font-black text-gray-800 text-center mb-2">
        ¿Cómo respondió el público?
      </h3>

      <div className="h-48 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 28, right: 8, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 16, fontWeight: 800, fill: "#374151" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any) => [`${value} respuestas`, "Cantidad"]}
              labelFormatter={(label: any) => `Opción ${label}`}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="count" radius={[10, 10, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.color}
                  fillOpacity={entry.correct ? 1 : 0.55}
                />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                style={{ fontWeight: 800, fill: "#374151", fontSize: 16 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        {data.map((entry, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 text-sm md:text-base rounded-xl px-3 py-2 ${
              entry.correct
                ? "bg-green-50 border border-green-200 font-black text-gray-800"
                : "text-gray-600 border border-transparent"
            }`}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-bold">{entry.name}.</span>
            <span className="truncate flex-1">{entry.text}</span>
            <span className="font-black whitespace-nowrap">
              {entry.count}
              {total > 0 ? ` (${Math.round((entry.count / total) * 100)}%)` : ""}
            </span>
            {entry.correct && <span className="text-green-600 font-black">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
