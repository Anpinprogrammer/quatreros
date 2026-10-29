import { seedAdminCatalog } from '../modules/admin/infrastructure/seed.js';
import { createDb } from '../platform/db/client.js';
import { seedPlatform } from '../platform/db/seed.js';

/**
 * Semilla base (todos los ambientes): flags, complementos, consecutivos, permisos y roles.
 * Idempotente.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('Falta DATABASE_URL\n');
  process.exit(1);
}
const handle = createDb(url, process.env.DATABASE_SSL === 'true');
try {
  await seedPlatform(handle.db);
  await seedAdminCatalog(handle.db);
  process.stdout.write('Semilla base aplicada (plataforma, permisos y roles)\n');
} finally {
  await handle.close();
}
