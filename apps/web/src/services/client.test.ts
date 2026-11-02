import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('envía Idempotency-Key cuando se indica (BR-007)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/api/v1/x', { method: 'POST', body: { a: 1 }, idempotencyKey: 'k-1' });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('k-1');
  });

  it('convierte Problem Details del servidor en ApiError con código', async () => {
    const problem = { type: 't', title: 'Cupo excedido', status: 409, code: 'CREDIT_LIMIT_EXCEEDED' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(problem), { status: 409 })));
    await expect(apiRequest('/api/v1/x')).rejects.toMatchObject({ code: 'CREDIT_LIMIT_EXCEEDED' });
  });

  it('sin red → ApiError claro que indica que no se registró nada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await apiRequest('/api/v1/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/no se registró nada/);
  });
});
