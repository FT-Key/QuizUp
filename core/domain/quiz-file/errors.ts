/** Error de validación/saneado de un archivo `.quizup` (mensaje visible al usuario). */
export class QuizFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizFileError";
  }
}
