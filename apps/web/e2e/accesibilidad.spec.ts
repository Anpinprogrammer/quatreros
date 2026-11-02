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
  const viewTabs = page.getByRole('tablist', { name: 'Vistas del Command Center' });
  const modulesTab = viewTabs.getByRole('tab', { name: 'Módulos' });
  const boardTab = viewTabs.getByRole('tab', { name: 'Tablero del día' });
  await expect(modulesTab).toHaveAttribute('aria-selected', 'true');
  await audit(page, info, 'command-center');
  await modulesTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(boardTab).toHaveAttribute('aria-selected', 'true');
  await expect(boardTab).toBeFocused();
  await audit(page, info, 'command-center-tablero');
  await page.goto('/erp/seccion/produccion');
  await audit(page, info, 'seccion-produccion');
});

test('ERP: catálogo y ficha de producto', async ({ page }, info) => {
  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto('/erp/catalogo');
  await audit(page, info, 'catalogo-productos');
  await page.getByRole('tab', { name: 'Materias primas' }).click();
  await audit(page, info, 'catalogo-materias-primas');
  await page.getByRole('tab', { name: 'Productos' }).click();
  await page
    .getByRole('link', { name: /Abrir ficha y precios/ })
    .first()
    .click();
  await audit(page, info, 'producto');
});

test('ERP: modo oscuro', async ({ page }, info) => {
  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.getByRole('button', { name: 'Usar modo oscuro' }).click();
  await audit(page, info, 'command-center-oscuro');
  await page.goto('/erp/seccion/produccion');
  await audit(page, info, 'produccion-oscuro');
  await page.goto('/erp/catalogo');
  await audit(page, info, 'catalogo-oscuro');
});

test('ERP: existencias, lotes y kardex', async ({ page }, info) => {
  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto('/erp/existencias');
  await audit(page, info, 'existencias');
  await page.getByRole('tab', { name: 'Lotes' }).click();
  await audit(page, info, 'existencias-lotes');
  await page.getByRole('link', { name: 'PT-2026-0001' }).first().click();
  await audit(page, info, 'lote');
  await page.goto('/erp/existencias');
  await page.getByRole('tab', { name: 'Kardex' }).click();
  await audit(page, info, 'existencias-kardex');
  await page.getByRole('tab', { name: 'Traslados' }).click();
  await audit(page, info, 'existencias-traslados');
  await page.getByRole('link', { name: 'T-0001' }).first().click();
  await audit(page, info, 'traslado');
});

test('ERP: compras y recepción', async ({ page }, info) => {
  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto('/erp/compras');
  await audit(page, info, 'compras');
  await page.getByRole('tab', { name: 'Proveedores' }).click();
  await audit(page, info, 'compras-proveedores');
  await page.getByRole('tab', { name: 'Compras' }).click();
  await page.getByRole('link', { name: 'C-0001' }).first().click();
  await audit(page, info, 'compra-detalle');
});

test('ERP: producción y recetas', async ({ page }, info) => {
  await signIn(page, 'produccion@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto('/erp/produccion');
  await audit(page, info, 'produccion-ordenes');
  await page.getByRole('link', { name: 'OP-0001' }).click();
  await audit(page, info, 'produccion-orden');
  await page.goto('/erp/produccion');
  await page.getByRole('tab', { name: 'Recetas' }).click();
  await audit(page, info, 'produccion-recetas');
  await page.getByRole('link', { name: 'Abrir receta' }).first().click();
  await audit(page, info, 'produccion-receta');
});

test('Ruta: despachos del distribuidor', async ({ page }, info) => {
  await signIn(page, 'reparto@quatreros.example');
  await expect(page).toHaveURL(/\/ruta$/);
  await audit(page, info, 'ruta-despachos');
});

test('ERP: trazabilidad de lote', async ({ page }, info) => {
  await signIn(page, 'produccion@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto('/erp/existencias');
  await page.getByRole('tab', { name: 'Lotes' }).click();
  await page.getByRole('link', { name: 'PT-2026-0001' }).first().click();
  await audit(page, info, 'lote-trazabilidad');
});
