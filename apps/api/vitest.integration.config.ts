import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integración contra PostgreSQL REAL (ADR-018): las reglas transaccionales
 * no se prueban con mocks.
 * - Si existe TEST_DATABASE_URL, se usa esa base (debe estar vacía o ser desechable).
 * - Si no, se levanta PostgreSQL 17 con Testcontainers (requiere Docker).
 */
export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['test/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
