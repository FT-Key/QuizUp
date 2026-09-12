/** URIs de Mongo (con credenciales) que nunca deben aparecer en logs. */
const MONGO_URI_RE = /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi;

const REDACTED_MONGO_URI = "[redacted-mongodb-uri]";

/** Redacta URIs de Mongo presentes en un texto. */
export function redactSecrets(text: string): string {
  return text.replace(MONGO_URI_RE, REDACTED_MONGO_URI);
}

/** Error → { name, message, stack } con secretos redactados (sin props adjuntas); resto → string redactado. */
export function toSafeLogDetail(cause: unknown): unknown {
  if (cause instanceof Error) {
    const detail: { name: string; message: string; stack?: string } = {
      name: cause.name,
      message: redactSecrets(cause.message),
    };
    if (cause.stack) detail.stack = redactSecrets(cause.stack);
    return detail;
  }
  return redactSecrets(String(cause));
}
