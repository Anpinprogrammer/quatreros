import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de flujos críticos (ADR-018) contra el sistema COMPLETO: la API compilada sirve la SPA.
 * Requisitos: `pnpm build`, base migrada y con semilla demo (`pnpm db:seed:demo`), y las variables
 * DATABASE_URL, APP_BASE_URL=http://localhost:3000 y DEMO_PASSWORD.
 * Si E2E_BASE_URL está definida, se usa un servidor ya levantado (p. ej. staging).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // los flujos comparten la misma base de demostración
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Permite usar un Chromium ya instalado (entornos sin acceso a la descarga de navegadores).
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
            args: ['--no-sandbox', '--disable-gpu', '--no-zygote'],
          },
        }
      : {}),
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'tableta', use: { ...devices['Galaxy Tab S9'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'node ../api/dist/main.js',
          url: `${baseURL}/ready`,
          reuseExistingServer: !process.env.CI,
          env: { NODE_ENV: 'development', LOG_LEVEL: 'warn', PORT: '3000', AUTH_RATE_LIMIT_DISABLED: 'true' },
        },
      }),
});
