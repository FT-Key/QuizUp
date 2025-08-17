import { useEffect, useState, useRef } from "react";

export function useQuestionTimer(startTime: number, timeLimit: number) {
  const [timeLeft, setTimeLeft] = useState(
    Math.max(0, timeLimit - (Date.now() - startTime))
  );
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTimeLeft(Math.max(0, timeLimit - (Date.now() - startTime)));
    setIsFinished(false);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const remaining = timeLimit - (Date.now() - startTime);
      if (remaining <= 0) {
        setTimeLeft(0);
        setIsFinished(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setTimeLeft(remaining);
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime, timeLimit]);

  return { timeLeft, isFinished };
}
