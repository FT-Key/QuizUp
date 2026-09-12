import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Se usa el mismo `globalThis.mongooseCache` del legacy para compartir la
// conexión (convivencia US-09..US-12). El global está declarado tipado en
// `globals.d.ts`, así que se consume sin cast.
const cached: MongooseCache = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
};
globalThis.mongooseCache = cached;

/**
 * Conexión Mongo del adaptador de persistencia.
 * Misma semántica que `lib/mongoose.ts`: cache global `{ conn, promise }`,
 * connect-once secuencial y concurrente, y `conn` se reutiliza en llamadas
 * posteriores. La URI entra por parámetro (el default legacy vive en
 * `infra/config.ts`). Un fallo de conexión queda cacheado igual que en el
 * legacy (no se reintenta); no "mejorar" aquí.
 */
export async function connectToMongo(mongoUri: string): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
