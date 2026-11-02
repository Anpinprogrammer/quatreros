import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Entrega 4 — RF-033, RF-081..083: receta versionada, orden planificada, consumo por lote
 * y cierre con lote PT y rendimiento.
 */
test('productor consume la orden planificada y la cierra con lote PT', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'El flujo completo se valida en escritorio');

  await signIn(page, 'produccion@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto('/erp/produccion');
  await expect(page.getByRole('heading', { name: 'Órdenes de producción' })).toBeVisible();

  // RF-033: receta vigente con historial de versiones.
  await page.getByRole('tab', { name: 'Recetas' }).click();
  await page.getByRole('link', { name: 'Abrir receta' }).first().click();
  await expect(page.getByRole('heading', { name: /Receta · Chorizo Santarrosano/ })).toBeVisible();
  await expect(page.getByText('Versión 1')).toBeVisible();
  await expect(page.getByText('Vigente', { exact: true })).toBeVisible();

  // RF-081: la orden sembrada está planificada.
  await page.goto('/erp/produccion');
  await page.getByRole('link', { name: 'OP-0001' }).click();
  await expect(page.getByRole('heading', { name: 'Orden OP-0001' })).toBeVisible();
  await expect(page.getByText('Planificada', { exact: true })).toBeVisible();

  // RF-082: consumo real con los lotes sugeridos por FEFO.
  const consumeForm = page.getByRole('form', { name: 'Registrar consumo de OP-0001' });
  await consumeForm.getByRole('button', { name: 'Registrar consumo' }).click();
  await expect(page.getByText('Consumo registrado. La orden está en proceso.')).toBeVisible();
  await expect(page.getByText('En proceso', { exact: true })).toBeVisible();
  await expect(page.getByText('MP-2026-0001')).toBeVisible();

  // RF-083: cierre por presentación con lote PT y rendimiento.
  const closeForm = page.getByRole('form', { name: 'Cerrar orden OP-0001' });
  await closeForm.getByLabel('Producido · Unidad').fill('50');
  await closeForm.getByLabel('Producido · Paquete x10').fill('5');
  await closeForm.getByRole('button', { name: 'Cerrar orden y crear lote PT' }).click();
  await expect(page.getByText(/Orden cerrada\. Lote PT-\d{4}-\d{4} creado\./)).toBeVisible();
  await expect(page.getByText('Cerrada', { exact: true })).toBeVisible();
  await expect(page.getByText(/PT-\d{4}-\d{4}/).first()).toBeVisible();
});
