import { expect, test } from '@playwright/test';
import { openSection, signIn } from './helpers';

/**
 * Entrega 2a — catálogo desde los roles que no tienen segundo factor.
 * La creación de producto y precios con el administrador vive en acceso.spec.ts (allí ya está el TOTP).
 */
test.beforeAll(() => {
  if (!process.env.DEMO_PASSWORD) {
    throw new Error('Define DEMO_PASSWORD (la misma usada en pnpm db:seed:demo)');
  }
});

test('comprador consulta el catálogo y crea una materia prima', async ({ page }) => {
  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);

  await openSection(page, /Producción/);
  await expect(page.getByRole('heading', { name: 'Producción', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Catálogo y precios/ }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo y precios' })).toBeVisible();

  // Los productos sembrados se leen; el comprador no tiene permiso para editarlos.
  await expect(page.getByText('Chorizo Santarrosano')).toBeVisible();
  await expect(page.getByText(/1\.300/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear producto' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Editar Chorizo/ })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Materias primas' }).click();
  await expect(page.getByRole('heading', { name: 'Materias primas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Carne de cerdo magra' })).toBeVisible();

  const name = `Sal de pruebas ${String(Date.now())}`;
  await page.getByRole('button', { name: 'Crear materia prima' }).click();
  const form = page.getByRole('form', { name: 'Crear materia prima' });
  await form.getByLabel('Nombre').fill(name);
  await form.getByLabel('Unidad de inventario').selectOption('kg');
  await form.getByLabel('Controla vencimiento').check();
  await form.getByRole('button', { name: 'Crear materia prima' }).click();

  await expect(page.getByText(`${name} quedó en el catálogo de materias primas.`)).toBeVisible();
  await expect(page.getByRole('heading', { name })).toBeVisible();
});

test('productor consulta el catálogo en modo lectura', async ({ page }) => {
  await signIn(page, 'produccion@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);

  await page.goto('/erp/catalogo');
  await expect(page.getByRole('heading', { name: 'Catálogo y precios' })).toBeVisible();
  await expect(page.getByText('Chorizo Santarrosano')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear producto' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Materias primas' }).click();
  await expect(page.getByRole('heading', { name: 'Carne de cerdo magra' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear materia prima' })).toHaveCount(0);
});
