import type { QuestionImage } from "../question";

/** Pregunta ya saneada de un archivo `.quizup` (sin `id`: lo asigna la persistencia). */
export interface SanitizedQuestion {
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
  image: QuestionImage | null;
}

/** Resultado del saneado del archivo: input del builder de creación. */
export interface SanitizedQuiz {
  name?: string;
  questionTimeLimit?: number;
  questions: SanitizedQuestion[];
}
