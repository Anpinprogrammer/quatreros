import { loadEnv } from '../config/env.js';
import {
  DEMO_USERS,
  seedAdminCatalog,
  seedDemoSites,
  seedDemoUsers,
} from '../modules/admin/infrastructure/seed.js';
import { createAuth } from '../platform/auth/auth.js';
import { createAuthProvisioner } from '../platform/auth/provisioner.js';
import { createDb } from '../platform/db/client.js';
import { seedPlatform } from '../platform/db/seed.js';

/**
 * Datos de DEMOSTRACIÓN (especificación adm §9). Nunca en producción.
 * Uso: DEMO_PASSWORD="una clave de 12+ caracteres" pnpm db:seed:demo
 */
const env = loadEnv();
if (env.NODE_ENV === 'production') {
  process.stderr.write('La semilla de demostración no se ejecuta en producción.\n');
  process.exit(1);
}
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) {
  process.stderr.write('Define DEMO_PASSWORD (mínimo 12 caracteres) para los usuarios de demostración.\n');
  process.exit(1);
}

const handle = createDb(env.DATABASE_URL, env.DATABASE_SSL);
try {
  await seedPlatform(handle.db);
  await seedAdminCatalog(handle.db);
  const siteIds = await seedDemoSites(handle.db);
  const auth = createAuth(handle.db, env);
  const created = await seedDemoUsers(handle.db, createAuthProvisioner(auth, handle.db), password, siteIds);
  process.stdout.write(`Sedes de demostración listas. Usuarios nuevos: ${String(created.length)}\n`);
  for (const u of DEMO_USERS) process.stdout.write(`  ${u.role.padEnd(5)} ${u.email}\n`);
  process.stdout.write('Contraseña: la definida en DEMO_PASSWORD.\n');
} finally {
  await handle.close();
}
