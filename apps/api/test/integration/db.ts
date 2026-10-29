import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { inject } from 'vitest';
import * as schema from '../../src/platform/db/schema/index.js';

/** Conexión a la base de pruebas preparada por global-setup. */
export function connectTestDb() {
  const pool = new pg.Pool({
    connectionString: inject('databaseUrl'),
    // PGlite tiene una sola sesión real: una conexión evita mezclar transacciones.
    max: inject('singleSession') ? 1 : 5,
  });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { pool, db, close: () => pool.end() };
}
