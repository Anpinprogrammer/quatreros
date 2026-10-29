import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de flujos críticos (ADR-018). En CI corre contra staging o contra el build local.
 * Proyectos: escritorio (ERP), tableta (POS) y móvil (portal del distribuidor).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Permite usar un Chromium ya instalado (entornos sin acceso a la descarga de navegadores).
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
            args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--single-process'],
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
          command: 'pnpm build && pnpm preview --port 4173',
          port: 4173,
          reuseExistingServer: !process.env.CI,
        },
      }),
});
