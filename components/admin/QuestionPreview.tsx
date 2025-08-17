"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  question: any;
  showAnswer: boolean;
  playersWithAnswers?: number;
  totalPlayers?: number;
}

export const QuestionPreview = ({
  question,
  showAnswer,
  playersWithAnswers,
  totalPlayers,
}: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Question Preview</CardTitle>
        <CardDescription>The question players will answer</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-lg">{question.text}</p>
            {playersWithAnswers !== undefined && totalPlayers !== undefined && (
              <p className="text-sm text-gray-500">
                {playersWithAnswers}/{totalPlayers} players answered
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {question.options.map((option: string, index: number) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  showAnswer && index === question.correctAnswer
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                  {showAnswer && index === question.correctAnswer && (
                    <Badge variant="default" className="ml-auto">
                      Correct
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
