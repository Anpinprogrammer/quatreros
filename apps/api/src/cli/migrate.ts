import { runMigrations } from '../platform/db/migrate.js';

const url = process.env.DATABASE_MIGRATIONS_URL ?? process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('Falta DATABASE_MIGRATIONS_URL (o DATABASE_URL)\n');
  process.exit(1);
}
await runMigrations(url);
process.stdout.write('Migraciones aplicadas\n');
