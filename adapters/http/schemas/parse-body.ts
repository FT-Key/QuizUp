import { z, type ZodTypeAny } from "zod";
import { ValidationError } from "@/core/domain/errors";

/** Parsea con Zod y traduce cualquier fallo a un único mensaje legacy de la ruta. */
export function parseBody<TSchema extends ZodTypeAny>(
  schema: TSchema,
  raw: unknown,
  message: string
): z.infer<TSchema> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(message);
  return parsed.data;
}
