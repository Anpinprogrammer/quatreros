import { defineConfig } from 'drizzle-kit';

/**
 * Migraciones SQL versionadas y revisadas (ADR-005).
 * `pnpm db:generate` crea el SQL en ./drizzle; se revisa en el PR antes de fusionar.
 * Triggers, permisos y reglas que drizzle-kit no genera van en migraciones `--custom`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/platform/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  schemaFilter: ['auth', 'platform', 'audit'],
  dbCredentials: {
    url: process.env.DATABASE_MIGRATIONS_URL ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
