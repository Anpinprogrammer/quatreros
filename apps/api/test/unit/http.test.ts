import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { requireFeature } from '../../src/platform/features/flags.js';
import { AppError } from '../../src/platform/http/errors.js';
import { allFlagsOff, buildTestApp } from '../helpers.js';

describe('salud', () => {
  it('/health responde ok con versión', async () => {
    const res = await request(buildTestApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', version: 'test' });
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('/ready responde 503 si la base de datos no responde', async () => {
    const app = buildTestApp({ pingDatabase: () => Promise.reject(new Error('down')) });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready', checks: { database: 'error' } });
  });

  it('respeta un X-Request-Id seguro y descarta uno inseguro', async () => {
    const ok = await request(buildTestApp()).get('/health').set('X-Request-Id', 'abc12345-xyz');
    expect(ok.headers['x-request-id']).toBe('abc12345-xyz');
    const bad = await request(buildTestApp()).get('/health').set('X-Request-Id', '<script>');
    expect(bad.headers['x-request-id']).toMatch(/^req_/);
  });
});

describe('errores en formato Problem Details (api-design §3)', () => {
  const app = buildTestApp({
    registerModules: (api) => {
      api.post('/echo', (req, res) => {
        const body = z.object({ quantity: z.string().min(1) }).parse(req.body);
        res.status(201).json(body);
      });
      api.get('/boom', () => {
        throw new Error('secreto interno');
      });
      api.get('/business', () => {
        throw AppError.conflict('INSUFFICIENT_STOCK', 'Existencia insuficiente', 'Faltan 3 unidades.');
      });
      api.get('/blocked', requireFeature(allFlagsOff, 'feature.inventory.packageOpening'), (_req, res) => {
        res.json({ ok: true });
      });
    },
  });

  it('ruta inexistente → 404 problem+json', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect((res.body as Record<string, unknown>).requestId).toMatch(/^req_/);
  });

  it('JSON mal formado → 400 MALFORMED_REQUEST', async () => {
    const res = await request(app).post('/api/v1/echo').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect((res.body as Record<string, unknown>).code).toBe('MALFORMED_REQUEST');
  });

  it('validación Zod → 422 con errores por campo', async () => {
    const res = await request(app).post('/api/v1/echo').send({ quantity: '' });
    expect(res.status).toBe(422);
    expect((res.body as Record<string, unknown>).code).toBe('VALIDATION_FAILED');
    expect((res.body as { errors: { path: string }[] }).errors[0]?.path).toBe('quantity');
  });

  it('regla de negocio → 409 con código estable', async () => {
    const res = await request(app).get('/api/v1/business');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', detail: 'Faltan 3 unidades.' });
  });

  it('error no controlado → 500 sin filtrar detalles internos', async () => {
    const res = await request(app).get('/api/v1/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secreto interno');
  });

  it('funcionalidad bloqueada → 423 con la decisión pendiente', async () => {
    const res = await request(app).get('/api/v1/blocked');
    expect(res.status).toBe(423);
    expect(res.body).toMatchObject({ code: 'FEATURE_BLOCKED', blockedBy: 'P-06' });
  });

  it('aplica cabeceras de seguridad (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
