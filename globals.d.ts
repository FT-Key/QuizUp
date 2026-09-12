import type { Mongoose } from "mongoose";

// US-12 (B4): `lib/mongoose.ts` declaraba este global y fue eliminado junto con
// las rutas legacy. El adaptador canónico
// (`adapters/persistence/mongo/connection.ts`) usa el mismo
// `globalThis.mongooseCache` (sin cast), y `connection.test.ts` lo tipa
// desde acá. Se mantiene fuera de `adapters/persistence/**` (prohibido de tocar
// en US-12) sin alterar el runtime.
declare global {
  var mongooseCache: {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
  };
}

export {};
