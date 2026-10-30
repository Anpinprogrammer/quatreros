import { randomBytes } from 'node:crypto';
import type { Env } from '../src/config/env.js';
import { createApp, type AppDeps } from '../src/app.js';
import type { FeatureFlagReader } from '../src/platform/features/flags.js';
import { MemoryIdempotencyStore } from '../src/platform/idempotency/store.js';
import { createLogger } from '../src/platform/logger.js';

export const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  APP_BASE_URL: 'http://localhost:5173',
  LOG_LEVEL: 'silent',
  TZ_BUSINESS: 'America/Bogota',
  DATABASE_URL: 'postgres://unused',
  DATABASE_SSL: false,
  // Generado en cada ejecución: ningún secreto fijo en el repositorio (secrets-policy).
  BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
  APP_VERSION: 'test',
  AUTH_RATE_LIMIT_DISABLED: false,
};

export const allFlagsOff: FeatureFlagReader = { isEnabled: () => Promise.resolve(false) };

export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  return createApp({
    env: testEnv,
    logger: createLogger('silent'),
    pingDatabase: () => Promise.resolve(),
    idempotency: new MemoryIdempotencyStore(),
    flags: allFlagsOff,
    ...overrides,
  });
}
