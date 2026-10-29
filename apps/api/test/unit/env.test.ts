import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

describe('loadEnv', () => {
  it('falla con mensaje claro si falta DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('aplica valores por defecto en desarrollo', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://x' });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_SSL).toBe(false);
  });

  it('exige BETTER_AUTH_SECRET de 32+ caracteres en producción', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://x', NODE_ENV: 'production' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgres://x', NODE_ENV: 'production', BETTER_AUTH_SECRET: 'a'.repeat(32) }),
    ).not.toThrow();
  });
});
