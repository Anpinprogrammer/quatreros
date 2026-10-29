import { expect, test } from '@playwright/test';

test('la entrada lleva a los tres shells', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Quatreros' })).toBeVisible();
  await page.getByRole('link', { name: /Caja/ }).click();
  await expect(page.getByRole('heading', { name: 'Venta actual' })).toBeVisible();
  await page.goto('/ruta');
  await expect(page.getByRole('heading', { name: 'Despachos de hoy' })).toBeVisible();
  await page.goto('/erp');
  await expect(page.getByRole('navigation', { name: 'Módulos' })).toBeVisible();
});
