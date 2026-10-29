import { sql } from 'drizzle-orm';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { createDb } from '../../src/platform/db/client.js';

/**
 * Si PostgreSQL cierra una conexión inactiva (reinicio, mantenimiento, failover del hosting),
 * el proceso no debe caerse: se registra y la siguiente consulta usa una conexión nueva.
 * PGlite no permite terminar sesiones ajenas, así que la prueba corre solo con PostgreSQL real.
 */
describe.skipIf(inject('singleSession'))('resiliencia de la conexión', () => {
  it('sobrevive a una conexión inactiva terminada por el servidor', async () => {
    const url = inject('databaseUrl');
    const idleErrors: Error[] = [];
    const handle = createDb(url, false, (err) => idleErrors.push(err));
    try {
      const pidResult = await handle.db.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      const pid = pidResult.rows[0]?.pid;
      expect(pid).toBeTypeOf('number');

      // Otra sesión del mismo rol termina la conexión, que ya volvió inactiva al pool.
      const killer = new pg.Client({ connectionString: url });
      await killer.connect();
      await killer.query('select pg_terminate_backend($1)', [pid]);
      await killer.end();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(idleErrors.length).toBe(1);
      const after = await handle.db.execute<{ ok: number }>(sql`select 1 as ok`);
      expect(after.rows[0]?.ok).toBe(1);
    } finally {
      await handle.close();
    }
  });
});
