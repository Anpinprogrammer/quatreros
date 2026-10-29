import type { TestProject } from 'vitest/node';
import { runMigrations } from '../../src/platform/db/migrate.js';

/**
 * Base de datos para pruebas de integración (ADR-018). Tres modos, en orden:
 *  1. TEST_DATABASE_URL — una base PostgreSQL existente y desechable (CI usa un service container).
 *     Si además existe TEST_DATABASE_MIGRATIONS_URL, las migraciones corren con ese rol (dueño) y las
 *     pruebas con el rol de la aplicación: así se validan también los permisos (ADR-013).
 *  2. TEST_DB=pglite    — PostgreSQL embebido (PGlite) con servidor de red. Útil sin Docker.
 *                         Limitación: una sola sesión real; NO sirve para pruebas de concurrencia.
 *  3. Por defecto       — PostgreSQL 17 con Testcontainers (requiere Docker).
 */
export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  let mode: 'external' | 'pglite' | 'container' = 'external';
  let teardown: (() => Promise<void>) | undefined;

  if (!url && process.env.TEST_DB === 'pglite') {
    mode = 'pglite';
    const { PGlite } = await import('@electric-sql/pglite');
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
    const db = await PGlite.create();
    const port = Number(process.env.TEST_PGLITE_PORT ?? 55432);
    const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
    await server.start();
    url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
    teardown = async () => {
      await server.stop();
      await db.close();
    };
  } else if (!url) {
    mode = 'container';
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const container = await new PostgreSqlContainer('postgres:17-alpine').start();
    url = container.getConnectionUri();
    teardown = async () => {
      await container.stop();
    };
  }

  const migrationsUrl = (mode === 'external' && process.env.TEST_DATABASE_MIGRATIONS_URL) || url;
  await runMigrations(migrationsUrl);
  project.provide('databaseUrl', url);
  project.provide('migrationsUrl', migrationsUrl);
  project.provide('singleSession', mode === 'pglite');
  return teardown;
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    migrationsUrl: string;
    singleSession: boolean;
  }
}
