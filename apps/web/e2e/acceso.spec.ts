import { expect, test } from '@playwright/test';
import { DEMO_PASSWORD, signIn, signOut, totp } from './helpers';

/**
 * Entrega 1 — criterios de aceptación de adm/acceso-usuarios §7 en el navegador.
 * Requiere la semilla demo recién aplicada (el administrador aún sin segundo factor).
 */
test.beforeAll(() => {
  if (!DEMO_PASSWORD) throw new Error('Define DEMO_PASSWORD (la misma usada en pnpm db:seed:demo)');
});

test('el cajero ingresa y queda en Caja', async ({ page }) => {
  await signIn(page, 'caja@quatreros.example');
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByRole('heading', { name: 'Venta actual' })).toBeVisible();
  await expect(page.getByText('Camila Caja')).toBeVisible();
  await signOut(page);
});

test('contraseña incorrecta muestra un mensaje genérico', async ({ page }) => {
  await signIn(page, 'caja@quatreros.example', 'clave-equivocada-123');
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
});

test('el repartidor entra al portal de Ruta', async ({ page }) => {
  await signIn(page, 'reparto@quatreros.example');
  await expect(page).toHaveURL(/\/ruta$/);
  await expect(page.getByRole('heading', { name: 'Despachos de hoy' })).toBeVisible();
});

test('administrador: configura el segundo factor, crea un repartidor y este ingresa', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'El flujo de administración se valida en escritorio');

  await signIn(page, 'admin@quatreros.example');
  await expect(page).toHaveURL(/\/seguridad\/segundo-factor$/);

  await page.getByLabel('Tu contraseña actual').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible();
  const secret = (await page.getByTestId('clave-manual').getAttribute('data-key')) ?? '';
  await page.getByLabel('Código de 6 dígitos que muestra la aplicación').fill(totp(secret));
  await page.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByText('Verificación en dos pasos activada.')).toBeVisible();
  await page.getByRole('button', { name: 'Ya los guardé, continuar' }).click();

  await expect(page).toHaveURL(/\/erp$/);
  await page
    .getByRole('navigation', { name: 'Módulos' })
    .getByRole('link', { name: /Usuarios y permisos/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Usuarios', exact: true })).toBeVisible();

  const email = `juan.${String(Date.now())}@quatreros.example`;
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  const form = page.getByRole('form', { name: 'Crear usuario' });
  await form.getByLabel('Nombre completo').fill('Juan Repartidor');
  await form.getByLabel('Correo').fill(email);
  await form.getByLabel('Contraseña temporal').fill(DEMO_PASSWORD);
  await form.getByLabel('Distribuidor').check();
  await form.getByLabel(/Bodega principal/).check();
  await form.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(page.getByText('Juan Repartidor ya puede ingresar')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: new RegExp(email) })).toBeVisible();

  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/ruta$/);

  // Un nuevo ingreso del administrador pide el código antes de entrar.
  await signOut(page);
  await signIn(page, 'admin@quatreros.example');
  await page.getByLabel('Código de 6 dígitos').fill(totp(secret));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page).toHaveURL(/\/erp$/);

  // Desactivar con confirmación dentro de la fila; la persona ya no puede ingresar.
  await page
    .getByRole('navigation', { name: 'Módulos' })
    .getByRole('link', { name: /Usuarios y permisos/ })
    .click();
  await page.getByRole('button', { name: 'Desactivar a Juan Repartidor' }).click();
  const confirm = page.getByRole('group', { name: 'Confirmar desactivación' });
  await expect(confirm.getByRole('button', { name: 'No' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Sí, desactivar' }).click();
  await expect(page.getByText('Juan Repartidor quedó desactivado.')).toBeVisible();

  await signOut(page);
  await signIn(page, email);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/ingresar/);
});
