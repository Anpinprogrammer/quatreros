import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { requireIdempotency } from '../../src/platform/idempotency/middleware.js';
import { MemoryIdempotencyStore } from '../../src/platform/idempotency/store.js';
import { buildTestApp } from '../helpers.js';

/** Simula un usuario autenticado (la sesión real se prueba en integración). */
const fakeActor: RequestHandler = (req, _res, next) => {
  req.ctx.actorId = 'user-1';
  next();
};

describe('Idempotency-Key (ADR-010, BR-007)', () => {
  let executions = 0;
  let store: MemoryIdempotencyStore;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    executions = 0;
    store = new MemoryIdempotencyStore();
    app = buildTestApp({
      idempotency: store,
      registerModules: (api) => {
        api.post('/deliveries', fakeActor, requireIdempotency(store), (_req, res) => {
          executions += 1;
          res.status(201).json({ id: `D-${executions}` });
        });
        api.post('/fails', fakeActor, requireIdempotency(store), (_req, res) => {
          executions += 1;
          res.status(500).json({ error: 'transitorio' });
        });
      },
    });
  });

  it('sin cabecera → 428', async () => {
    const res = await request(app).post('/api/v1/deliveries').send({ q: '1' });
    expect(res.status).toBe(428);
    expect((res.body as Record<string, unknown>).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(executions).toBe(0);
  });

  it('cabecera que no es UUID → 422', async () => {
    const res = await request(app).post('/api/v1/deliveries').set('Idempotency-Key', 'abc').send({});
    expect(res.status).toBe(422);
  });

  it('reintento con la misma clave y cuerpo → misma respuesta, una sola ejecución', async () => {
    const key = randomUUID();
    const first = await request(app).post('/api/v1/deliveries').set('Idempotency-Key', key).send({ q: '6' });
    const second = await request(app).post('/api/v1/deliveries').set('Idempotency-Key', key).send({ q: '6' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(executions).toBe(1);
  });

  it('misma clave con otro cuerpo → 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const key = randomUUID();
    await request(app).post('/api/v1/deliveries').set('Idempotency-Key', key).send({ q: '6' });
    const res = await request(app).post('/api/v1/deliveries').set('Idempotency-Key', key).send({ q: '7' });
    expect(res.status).toBe(422);
    expect((res.body as Record<string, unknown>).code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(executions).toBe(1);
  });

  it('un error 5xx libera la clave para poder reintentar', async () => {
    const key = randomUUID();
    await request(app).post('/api/v1/fails').set('Idempotency-Key', key).send({});
    await request(app).post('/api/v1/fails').set('Idempotency-Key', key).send({});
    expect(executions).toBe(2);
  });
});
