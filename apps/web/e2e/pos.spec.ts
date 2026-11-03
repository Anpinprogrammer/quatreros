import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { signIn } from './helpers';

async function audit(page: Page, info: TestInfo, name: string) {
  await page.waitForLoadState('networkidle');
  // Las transiciones de diálogos y overlays alteran los colores medidos por axe.
  await page.evaluate(async () => {
    await Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    );
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${String(v.nodes.length)})`);
  expect(summary, `Violaciones de accesibilidad en ${name}`).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow, `Desplazamiento horizontal en ${name}`).toBe(false);
}

test('cajero abre turno, vende con pago mixto y cierra con diferencia', async ({ page }, info) => {
  test.setTimeout(60_000);
  await signIn(page, 'caja@quatreros.example');
  await expect(page).toHaveURL(/\/pos$/);

  const openButton = page.getByRole('button', { name: 'Abrir turno' });
  await expect(openButton.or(page.getByRole('heading', { name: 'Productos' }))).toBeVisible();
  if (await openButton.isVisible()) {
    await page.getByLabel('Base de efectivo').fill('100000');
    await openButton.click();
  }
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
  await audit(page, info, 'pos-catalogo');

  await page.getByRole('button', { name: /Picada Quatreros XL/ }).click();
  await page.getByRole('button', { name: /Chorizo Santarrosano.*Unidad/ }).click();
  await page.getByRole('button', { name: /^Cobrar \$/ }).click();

  const payment = page.getByRole('dialog');
  await payment.getByLabel('Efectivo').fill('30000');
  await payment.getByLabel('Transferencia').fill('17600');
  await payment.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(page.getByRole('heading', { name: 'Venta registrada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comprobante interno' })).toBeVisible();
  await audit(page, info, 'pos-comprobante');

  await page.getByRole('dialog').getByRole('button', { name: 'Nueva venta' }).click();

  await page.getByRole('button', { name: 'Cobrar cartera' }).click();
  const portfolio = page.getByRole('dialog');
  await portfolio.getByLabel('Cliente').selectOption({ label: 'Tienda Doña Rosa' });
  await portfolio.getByLabel('Monto').fill('1000');
  await audit(page, info, 'pos-cobrar-cartera');
  await portfolio.getByRole('button', { name: 'Registrar abono' }).click();
  await expect(portfolio.getByText('Abono registrado')).toBeVisible();
  await portfolio.getByRole('button', { name: 'Listo' }).click();

  await page.locator('header').getByRole('button', { name: 'Cerrar turno' }).click();
  const close = page.getByRole('dialog');
  await close.getByLabel('Efectivo contado').fill('125000');
  await close.getByLabel('Transferencia contado').fill('17600');
  await close.getByLabel('Justificación de la diferencia').fill('Faltante de prueba en efectivo.');
  await close.getByRole('button', { name: 'Cerrar turno' }).click();

  await expect(page.getByText('Cerrado con diferencia')).toBeVisible();
  await expect(page.getByText('Pendiente de revisión')).toBeVisible();
});
