"use client";

import { Check, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";
import { QUIZ_FILE_LIMITS } from "@/lib/quizFile";
import type { QuestionImage } from "@/types";
import type { QuizDraftQuestion } from "@/core/application/builders/quiz-builder";
import { KAHOOT_COLORS, OPTION_ICONS } from "@/constants/option-colors";

/** Orden del creador: Red, Blue, Green, Yellow (invertido 2↔3 vs. admin). */
const OPTION_COLORS = [
  KAHOOT_COLORS.red,
  KAHOOT_COLORS.blue,
  KAHOOT_COLORS.green,
  KAHOOT_COLORS.yellow,
];

interface QuestionEditorProps {
  index: number;
  question: QuizDraftQuestion;
  canRemove: boolean;
  onRemove: () => void;
  onTextChange: (text: string) => void;
  onOptionChange: (optionIndex: number, value: string) => void;
  onCorrectAnswerChange: (optionIndex: number) => void;
  onImageChange: (image: QuestionImage | null) => void;
}

export function QuestionEditor({
  index,
  question,
  canRemove,
  onRemove,
  onTextChange,
  onOptionChange,
  onCorrectAnswerChange,
  onImageChange,
}: QuestionEditorProps) {
  return (
    <div className="bg-gray-50 rounded-3xl p-6 space-y-5 border-2 border-gray-100">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
            style={{
              background: OPTION_COLORS[index % 4].bg
            }}
          >
            {index + 1}
          </div>
          <span className="font-bold text-gray-700">Question {index + 1}</span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-2 text-gray-400 hover:text-[#E21B3C] hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      <textarea
        placeholder="Type your question here..."
        value={question.text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={2}
        maxLength={QUIZ_FILE_LIMITS.maxQuestionTextLength}
        className="w-full px-4 py-3 text-base font-medium border-2 border-gray-200 rounded-2xl focus:border-[#1368CE] focus:ring-4 focus:ring-[#1368CE]/20 transition-all outline-none resize-none"
        required
      />

      <ImagePicker
        image={question.image}
        onChange={onImageChange}
      />

      <div className="space-y-3">
        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
          Answer Options
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((option, optionIndex) => (
            <div
              key={optionIndex}
              className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: OPTION_COLORS[optionIndex].bg,
              }}
            >

              <button
                type="button"
                onClick={() => onCorrectAnswerChange(optionIndex)}
                className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 ${
                  question.correctAnswer === optionIndex
                    ? "bg-white text-[#26890C] scale-110"
                    : "bg-black/20 text-white/70 hover:bg-black/30"
                }`}
                title="Mark as correct answer"
              >
                <Check className="h-5 w-5" />
              </button>

              <div className="text-4xl text-white/90 pt-3 pl-3">
                {OPTION_ICONS[optionIndex]}
              </div>

              <div className="p-3 pt-1">
                <input
                  type="text"
                  placeholder={OPTION_COLORS[optionIndex].name}
                  value={option}
                  onChange={(e) => onOptionChange(optionIndex, e.target.value)}
                  maxLength={QUIZ_FILE_LIMITS.maxOptionLength}
                  className="w-full px-3 py-2 text-base font-bold text-white placeholder-white/60 bg-black/20 rounded-xl border-2 border-white/30 focus:border-white focus:ring-2 focus:ring-white/50 transition-all outline-none"
                  required
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: OPTION_COLORS[question.correctAnswer].bg }}
        >
          <Check className="h-3 w-3 text-white" />
        </div>
        <span>
          Correct answer: <strong>{OPTION_COLORS[question.correctAnswer].name}</strong>
          {question.options[question.correctAnswer] && (
            <span className="text-gray-500"> - {question.options[question.correctAnswer]}</span>
          )}
        </span>
      </div>
    </div>
  );
}
