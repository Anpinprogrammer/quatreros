import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Accesibilidad WCAG 2.1 AA de cada pantalla (sistema de diseño, Anexo A) y captura para revisión visual.
 * Toda pantalla nueva se agrega aquí. Las capturas quedan adjuntas en el reporte HTML de Playwright
 * (`pnpm --filter @quatreros/web exec playwright show-report`).
 * No usa al administrador: su segundo factor se configura en acceso.spec.ts.
 */
async function audit(page: Page, info: TestInfo, name: string) {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${String(v.nodes.length)})`);
  expect(summary, `Violaciones de accesibilidad en ${name}`).toEqual([]);
  // Sin desplazamiento horizontal de la página (WCAG 1.4.10).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow, `Desplazamiento horizontal en ${name}`).toBe(false);
}

test('ingreso', async ({ page }, info) => {
  await page.goto('/ingresar');
  await audit(page, info, 'ingreso');
});

test('Caja', async ({ page }, info) => {
  await signIn(page, 'caja@quatreros.example');
  await expect(page).toHaveURL(/\/pos$/);
  await audit(page, info, 'caja');
});

test('Distribución', async ({ page }, info) => {
  await signIn(page, 'reparto@quatreros.example');
  await expect(page).toHaveURL(/\/ruta$/);
  await audit(page, info, 'distribucion');
});

test('ERP: Command Center y secciones', async ({ page }, info) => {
  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await audit(page, info, 'command-center');
  await page.goto('/erp/seccion/produccion');
  await audit(page, info, 'seccion-produccion');
});
