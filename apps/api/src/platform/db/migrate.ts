import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/**
 * Aplica las migraciones pendientes con el rol dueño de esquemas (ADR-013).
 * Se ejecuta en CI/CD antes de arrancar la aplicación, nunca desde la aplicación en ejecución.
 */
export async function runMigrations(
  connectionString: string,
  migrationsFolder = MIGRATIONS_FOLDER,
): Promise<void> {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    // El historial de migraciones queda en el esquema `drizzle` (por defecto), separado de los datos.
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
