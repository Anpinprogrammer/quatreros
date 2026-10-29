import { createDb } from '../platform/db/client.js';
import { seedPlatform } from '../platform/db/seed.js';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('Falta DATABASE_URL\n');
  process.exit(1);
}
const handle = createDb(url, process.env.DATABASE_SSL === 'true');
try {
  await seedPlatform(handle.db);
  process.stdout.write('Datos semilla de plataforma aplicados\n');
} finally {
  await handle.close();
}
