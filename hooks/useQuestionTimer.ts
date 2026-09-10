import { useEffect, useState, useRef } from "react";

export function useQuestionTimer(startTime: number, timeLimit: number, questionId?: string) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Trackear el último (questionId+startTime) que arrancó el timer
  const lastKeyRef = useRef("");

  useEffect(() => {
    const key = `${questionId ?? ""}:${startTime}`;

    // Si no hay startTime válido, mostrar tiempo completo y parar
    if (startTime <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimeLeft(timeLimit);
      setIsFinished(false);
      lastKeyRef.current = key;
      return;
    }

    // Evitar reiniciar si ya estamos corriendo para este mismo (pregunta+startTime)
    if (key === lastKeyRef.current && intervalRef.current) return;
    lastKeyRef.current = key;

    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsFinished(false);

    const tick = () => {
      const remaining = timeLimit - (Date.now() - startTime);
      if (remaining <= 0) {
        setTimeLeft(0);
        setIsFinished(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setTimeLeft(remaining);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [questionId, startTime, timeLimit]);

  return { timeLeft, isFinished };
}
