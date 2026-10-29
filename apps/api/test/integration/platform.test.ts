import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { recordAudit } from '../../src/platform/audit/audit.js';
import { createAuth } from '../../src/platform/auth/auth.js';
import { runMigrations } from '../../src/platform/db/migrate.js';
import { featureFlags } from '../../src/platform/db/schema/platform.js';
import { seedPlatform } from '../../src/platform/db/seed.js';
import { PgFeatureFlags } from '../../src/platform/features/flags.js';
import { requireIdempotency } from '../../src/platform/idempotency/middleware.js';
import { PgIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp, testEnv } from '../helpers.js';
import { connectTestDb } from './db.js';

const handle = connectTestDb();

/** Drizzle envuelve el error de PostgreSQL en `cause`; devuelve su mensaje. */
async function dbError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'sin error';
  } catch (err) {
    const cause = (err as { cause?: { message?: string } }).cause;
    return cause?.message ?? String(err);
  }
}
const { db } = handle;

beforeAll(async () => {
  await seedPlatform(db);
});
afterAll(async () => {
  await handle.close();
});

describe('migraciones (ADR-005)', () => {
  it('crean los esquemas auth, platform y audit', async () => {
    const res = await db.execute<{ schema_name: string }>(
      sql`select schema_name from information_schema.schemata where schema_name in ('auth','platform','audit') order by 1`,
    );
    expect(res.rows.map((r) => r.schema_name)).toEqual(['audit', 'auth', 'platform']);
  });

  it('son repetibles: volver a ejecutarlas no falla ni duplica', async () => {
    await expect(runMigrations(inject('migrationsUrl'))).resolves.toBeUndefined();
  });
});

describe('datos semilla', () => {
  it('dejan todas las funcionalidades bloqueadas APAGADAS con su decisión pendiente', async () => {
    await seedPlatform(db); // idempotente
    const rows = await db.select().from(featureFlags);
    expect(rows.length).toBe(8);
    expect(rows.every((r) => !r.isEnabled)).toBe(true);
    expect(rows.find((r) => r.key === 'feature.inventory.packageOpening')?.blockedBy).toBe('P-06');
    const flags = new PgFeatureFlags(db);
    expect(await flags.isEnabled('feature.accounting.posting')).toBe(false);
  });
});

describe('auditoría append-only (ADR-012, RNF-090)', () => {
  // Dos defensas: el rol de aplicación no tiene UPDATE/DELETE (ADR-013) y, aun con privilegios,
  // el trigger append-only lo impide (ADR-012). Según el rol de prueba responde una u otra.
  it('permite insertar y rechaza modificar o borrar', async () => {
    await recordAudit(
      db,
      { requestId: 'req_test', channel: 'system' },
      {
        action: 'plat.test',
        entityType: 'test',
        entityId: '1',
        after: { ok: true },
      },
    );
    await expect(dbError(db.execute(sql`update audit.audit_log set action = 'x'`))).resolves.toMatch(
      /append-only|permission denied/,
    );
    await expect(dbError(db.execute(sql`delete from audit.audit_log`))).resolves.toMatch(
      /append-only|permission denied/,
    );
  });
});

describe('idempotencia con PostgreSQL (ADR-010)', () => {
  it('repite la respuesta guardada sin ejecutar dos veces', async () => {
    const store = new PgIdempotencyStore(db);
    let executions = 0;
    const actor: RequestHandler = (req, _res, next) => {
      req.ctx.actorId = 'user-int';
      next();
    };
    const app = buildTestApp({
      idempotency: store,
      registerModules: (api) => {
        api.post('/ops', actor, requireIdempotency(store), (_req, res) => {
          executions += 1;
          res.status(201).json({ n: executions });
        });
      },
    });
    const key = randomUUID();
    const a = await request(app).post('/api/v1/ops').set('Idempotency-Key', key).send({ x: 1 });
    // Espera a que se registre el resultado (se guarda al terminar la respuesta).
    await new Promise((r) => setTimeout(r, 100));
    const b = await request(app).post('/api/v1/ops').set('Idempotency-Key', key).send({ x: 1 });
    expect(a.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(executions).toBe(1);
  });
});

describe('salud con base de datos real', () => {
  it('/ready responde 200', async () => {
    const app = buildTestApp({
      pingDatabase: async () => {
        await db.execute(sql`select 1`);
      },
    });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect((res.body as { checks: { database: string } }).checks.database).toBe('ok');
  });
});

describe('autenticación (ADR-007)', () => {
  const auth = createAuth(db, { ...testEnv, APP_BASE_URL: 'http://localhost:5173' });
  const app = buildTestApp({ auth });

  it('el registro público está deshabilitado (usuarios los crea el Administrador, RF-003)', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'nuevo@example.com', password: randomUUID(), name: 'Nuevo' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const users = await db.execute<{ n: number }>(sql`select count(*)::int as n from auth."user"`);
    expect(users.rows[0]?.n).toBe(0);
  });

  it('sin sesión, get-session devuelve null', async () => {
    const res = await request(app).get('/api/auth/get-session');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('trigger append-only aun para el dueño de esquemas (ADR-012)', () => {
  it('el rol dueño tampoco puede modificar la auditoría', async () => {
    const pg = await import('pg');
    const owner = new pg.default.Pool({ connectionString: inject('migrationsUrl'), max: 1 });
    try {
      await expect(owner.query(`update audit.audit_log set action = 'x'`)).rejects.toThrow(/append-only/);
    } finally {
      await owner.end();
    }
  });
});
