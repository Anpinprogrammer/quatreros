import { defineConfig } from 'vitest/config';

/** Pruebas unitarias: sin base de datos ni red (ADR-018). */
export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['src/**/*.ts'] },
  },
});
