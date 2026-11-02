import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Entrega 2b — existencias, kardex y trazabilidad con la semilla demo.
 * La carga inicial crea los lotes PT-2026-0001… y MP-2026-0001….
 */
test.beforeAll(() => {
  if (!process.env.DEMO_PASSWORD) {
    throw new Error('Define DEMO_PASSWORD (la misma usada en pnpm db:seed:demo)');
  }
});

test('comprador consulta existencias, lotes y kardex', async ({ page }) => {
  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);

  await page.goto('/erp/existencias');
  await expect(page.getByRole('heading', { name: 'Existencias y traslados' })).toBeVisible();
  await expect(page.getByText('Chorizo Santarrosano').first()).toBeVisible();
  await expect(page.getByText('PT-2026-0001').first()).toBeVisible();
  await expect(page.getByText('Lotes por vencer')).toBeVisible();

  await page.getByRole('tab', { name: 'Kardex' }).click();
  await expect(page.getByRole('cell', { name: 'Carga inicial' }).first()).toBeVisible();
  await expect(page.getByText('Ana Administradora').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Lotes' }).click();
  await page.getByRole('link', { name: 'PT-2026-0001' }).first().click();
  await expect(page.getByRole('heading', { name: /Lote PT-2026-0001/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saldos por ubicación' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Últimos movimientos' })).toBeVisible();
  await expect(page.getByText('Tu rol no consulta trazabilidad de lote.')).toBeVisible();
});

test('producción consulta la trazabilidad del lote', async ({ page }) => {
  await signIn(page, 'produccion@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);

  await page.goto('/erp/existencias');
  await page.getByRole('tab', { name: 'Lotes' }).click();
  await page.getByRole('link', { name: 'PT-2026-0001' }).first().click();
  await expect(page.getByRole('heading', { name: /Lote PT-2026-0001/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible();
  await expect(page.getByText('Sin insumos registrados')).toBeVisible();
  await expect(page.getByText('Sin despachos ni ventas')).toBeVisible();
});
