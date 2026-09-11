import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Se usa el mismo `globalThis.mongooseCache` que `lib/mongoose.ts` para
// compartir la conexión si ambos conviven (convivencia US-09..US-12).
// El cast evita redeclarar el `declare global` del legacy y un conflicto de
// tipos por duplicación de `var` en el scope global.
const globalCache = globalThis as unknown as { mongooseCache?: MongooseCache };

const cached: MongooseCache = globalCache.mongooseCache ?? {
  conn: null,
  promise: null,
};
globalCache.mongooseCache = cached;

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
