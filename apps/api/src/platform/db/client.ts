import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  pool: pg.Pool;
  db: Database;
  close: () => Promise<void>;
}

/**
 * Pool de conexiones con el rol de la aplicación (ADR-013).
 * Tamaño pequeño: 6–15 usuarios y un plan de BD básico (deployment-design §1).
 */
export function createDb(
  connectionString: string,
  ssl = false,
  onIdleError: (err: Error) => void = () => undefined,
): DbHandle {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
  // Una conexión inactiva puede cerrarse desde PostgreSQL (reinicio, mantenimiento, failover).
  // Sin este manejador, el evento 'error' sin escuchar tumba el proceso completo; el pool
  // descarta esa conexión y abre otra en la siguiente consulta.
  pool.on('error', onIdleError);
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { pool, db, close: () => pool.end() };
}

export { schema };
