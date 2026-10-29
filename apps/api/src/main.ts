import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createAuth } from './platform/auth/auth.js';
import { createDb } from './platform/db/client.js';
import { PgFeatureFlags } from './platform/features/flags.js';
import { PgIdempotencyStore } from './platform/idempotency/store.js';
import { createLogger } from './platform/logger.js';
import { registerModules } from './modules/index.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const { db, close } = createDb(env.DATABASE_URL, env.DATABASE_SSL);

const app = createApp({
  env,
  logger,
  pingDatabase: async () => {
    await db.execute(sql`select 1`);
  },
  idempotency: new PgIdempotencyStore(db),
  flags: new PgFeatureFlags(db),
  auth: createAuth(db, env),
  webDistDir: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  registerModules,
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Quatreros API escuchando');
});

// Cierre ordenado: deja de aceptar conexiones, termina las peticiones en curso y cierra la BD.
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Cerrando servidor');
  server.close(() => {
    close()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logger.error({ err }, 'Error cerrando la base de datos');
        process.exit(1);
      });
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
