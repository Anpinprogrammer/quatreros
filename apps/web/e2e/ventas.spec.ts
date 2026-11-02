import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { DEMO_PASSWORD, signIn, signOut, totp } from './helpers';

let managerSecret = '';

async function signInManager(page: Page) {
  await signIn(page, 'manager@quatreros.example');
  if (!managerSecret) {
    await expect(page).toHaveURL(/\/seguridad\/segundo-factor$/);
    await page.getByLabel('Tu contraseña actual').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible();
    managerSecret = (await page.getByTestId('clave-manual').getAttribute('data-key')) ?? '';
    await page.getByLabel('Código de 6 dígitos que muestra la aplicación').fill(totp(managerSecret));
    await page.getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByText('Verificación en dos pasos activada.')).toBeVisible();
    await page.getByRole('button', { name: 'Ya los guardé, continuar' }).click();
  } else {
    await page.getByLabel('Código de 6 dígitos').fill(totp(managerSecret));
    await page.getByRole('button', { name: 'Verificar' }).click();
  }
  await expect(page).toHaveURL(/\/erp$/);
}

async function audit(page: Page, info: TestInfo, name: string) {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  expect(
    results.violations.map((v) => `${v.id}: ${v.help} (${String(v.nodes.length)})`),
    `Violaciones de accesibilidad en ${name}`,
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow, `Desplazamiento horizontal en ${name}`).toBe(false);
}

test('manager crea pedido y despacho; el distribuidor entrega y devuelve', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'El flujo completo se valida en escritorio');

  await signInManager(page);
  await page.goto('/erp/ventas');
  await expect(page.getByRole('heading', { name: 'Clientes, pedidos y despachos' })).toBeVisible();
  await audit(page, info, 'ventas-clientes');

  // Pedido a crédito con el cliente sembrado.
  await page.getByRole('tab', { name: 'Pedidos' }).click();
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  const orderForm = page.getByRole('form', { name: 'Nuevo pedido' });
  await orderForm.getByLabel('Cliente').selectOption({ label: 'Restaurante La Brasa' });
  await orderForm.getByLabel('Pago').selectOption({ value: 'credit' });
  await orderForm.getByLabel('Presentación 1').selectOption({ label: 'Chorizo Santarrosano · Paquete x10' });
  await orderForm.getByLabel('Cantidad').fill('1');
  await orderForm.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByRole('heading', { name: /Pedido P-\d{4}/ })).toBeVisible();
  await expect(page.getByText('Confirmado', { exact: true })).toBeVisible();
  await audit(page, info, 'ventas-pedido');

  // Despacho con el pedido nuevo.
  await page.getByRole('link', { name: 'Ventas' }).click();
  await page.getByRole('tab', { name: 'Despachos' }).click();
  await page.getByRole('button', { name: 'Nuevo despacho' }).click();
  const dispatchForm = page.getByRole('form', { name: 'Nuevo despacho' });
  await dispatchForm.getByLabel('Distribuidor').selectOption({ label: 'Diego Reparto' });
  await dispatchForm.getByRole('checkbox').last().check();
  await dispatchForm.getByRole('button', { name: 'Crear despacho' }).click();
  await expect(page.getByRole('heading', { name: /Despacho D-\d{4}/ })).toBeVisible();
  await expect(page.getByText('Preparado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar carga y salir' }).click();
  await expect(page.getByText('Despacho cargado y en ruta.')).toBeVisible();
  await expect(page.getByText('En ruta', { exact: true }).first()).toBeVisible();
  await audit(page, info, 'ventas-despacho');
  const dispatchNumber = await page.getByRole('heading', { name: /Despacho D-\d{4}/ }).innerText();
  const dispatchId = page.url().split('/').pop() ?? '';

  // El distribuidor entrega y devuelve desde el portal móvil.
  await signOut(page);
  await signIn(page, 'reparto@quatreros.example');
  await expect(page).toHaveURL(/\/ruta$/);
  await page.getByText(dispatchNumber.replace('Despacho ', '')).click();
  await expect(page.getByText('En ruta', { exact: true }).first()).toBeVisible();
  const deliverForm = page.getByRole('form', { name: /Entregar P-/ });
  await deliverForm.getByRole('button', { name: 'Registrar entrega' }).click();
  await expect(page.getByText(/Entrega de P-\d{4} registrada\./)).toBeVisible();

  const returnForm = page.getByRole('form', { name: 'Registrar devolución' });
  await returnForm.getByLabel('Línea entregada').selectOption({ index: 1 });
  await returnForm.getByLabel('Cantidad devuelta').fill('1');
  await returnForm.getByLabel('Motivo').fill('Empaque roto');
  await returnForm.getByRole('button', { name: 'Registrar devolución' }).click();
  await expect(page.getByText('Devolución registrada en inspección.')).toBeVisible();

  // El manager reincorpora la devolución.
  await signOut(page);
  await signInManager(page);
  await page.goto(`/erp/ventas/despachos/${dispatchId}`);
  await expect(page.getByText('En inspección')).toBeVisible();
  await page.getByRole('button', { name: 'Reincorporar' }).click();
  await expect(page.getByText(/reincorporada a la bodega/)).toBeVisible();
});
