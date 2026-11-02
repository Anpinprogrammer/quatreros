import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Entrega 3 — RF-050, RF-051 y RF-052: proveedor, compra y recepción parcial/total
 * que crea el lote de materia prima y mueve el inventario.
 */
test('comprador crea proveedor, compra y recibe la materia prima', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'El flujo completo se valida en escritorio');

  await signIn(page, 'compras@quatreros.example');
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto('/erp/compras');
  await expect(page.getByRole('heading', { name: 'Compras y recepción' })).toBeVisible();

  // RF-050: proveedor nuevo desde la pestaña Proveedores.
  await page.getByRole('tab', { name: 'Proveedores' }).click();
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click();
  const supplierForm = page.getByRole('form', { name: 'Nuevo proveedor' });
  const supplierName = `Proveedor E2E ${String(Date.now())}`;
  await supplierForm.getByLabel('Nombre o razón social').fill(supplierName);
  await supplierForm.getByLabel('Identificación (NIT)').fill(`E2E-${String(Date.now())}`);
  await supplierForm.getByRole('button', { name: 'Crear proveedor' }).click();
  await expect(page.getByText(`Proveedor ${supplierName} creado.`)).toBeVisible();
  await expect(page.getByRole('cell', { name: supplierName })).toBeVisible();

  // RF-051: compra de 5 kg de carne; no mueve inventario todavía.
  await page.getByRole('tab', { name: 'Compras' }).click();
  await page.getByRole('button', { name: 'Nueva compra' }).click();
  const purchaseForm = page.getByRole('form', { name: 'Nueva compra' });
  await purchaseForm.getByLabel('Proveedor').selectOption({ label: 'Cárnicos del Valle S.A.S.' });
  await purchaseForm.getByLabel('Materia prima 1').selectOption({ label: 'Carne de cerdo magra (kg)' });
  await purchaseForm.getByLabel('Cantidad').fill('5');
  await purchaseForm.getByLabel('Costo unitario').fill('20000');
  await purchaseForm.getByRole('button', { name: 'Registrar compra' }).click();

  await expect(page).toHaveURL(/\/erp\/compras\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: /Compra C-\d{4}/ })).toBeVisible();
  await expect(page.getByText('Pendiente de recepción')).toBeVisible();
  await expect(page.getByText('Sin recepciones')).toBeVisible();

  // RF-052: recepción parcial de 3 kg; crea lote y deja 2 kg pendientes.
  const receiveForm = page.getByRole('form', { name: /Recibir compra/ });
  await receiveForm.getByLabel('Ubicación de recepción').selectOption({ label: 'Principal' });
  await receiveForm.getByLabel('Recibido · Carne de cerdo magra').fill('3');
  await receiveForm.getByLabel('Vence · Carne de cerdo magra').fill('2027-12-31');
  await receiveForm.getByRole('button', { name: 'Confirmar recepción' }).click();
  await expect(
    page.getByText('Recepción registrada. La compra sigue abierta por el saldo pendiente.'),
  ).toBeVisible();
  await expect(page.getByText('Recibida parcialmente')).toBeVisible();
  await expect(page.getByText(/MP-\d{4}-\d{4}/).first()).toBeVisible();

  // Completar el saldo: la compra queda recibida.
  const secondReceive = page.getByRole('form', { name: /Recibir compra/ });
  await secondReceive.getByLabel('Vence · Carne de cerdo magra').fill('2027-12-31');
  await secondReceive.getByRole('button', { name: 'Confirmar recepción' }).click();
  await expect(page.getByText('Recepción registrada. La compra quedó completa.')).toBeVisible();
  await expect(page.getByText('Compra recibida completa.')).toBeVisible();
});
