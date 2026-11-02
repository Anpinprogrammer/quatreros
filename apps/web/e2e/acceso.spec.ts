import { expect, test } from '@playwright/test';
import { DEMO_PASSWORD, openSection, signIn, signOut, totp } from './helpers';

/**
 * Entrega 1 — criterios de aceptación de adm/acceso-usuarios §7 en el navegador.
 * Requiere la semilla demo recién aplicada (el administrador aún sin segundo factor).
 */
test.beforeAll(() => {
  if (!DEMO_PASSWORD) throw new Error('Define DEMO_PASSWORD (la misma usada en pnpm db:seed:demo)');
});

// Se comparte con el flujo de catálogo: el administrador ya tiene el segundo factor activo.
let adminSecret = '';

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
  await expect(page.getByRole('heading', { name: 'Rutas del día' })).toBeVisible();
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
  adminSecret = (await page.getByTestId('clave-manual').getAttribute('data-key')) ?? '';
  await page.getByLabel('Código de 6 dígitos que muestra la aplicación').fill(totp(adminSecret));
  await page.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByText('Verificación en dos pasos activada.')).toBeVisible();
  await page.getByRole('button', { name: 'Ya los guardé, continuar' }).click();

  await expect(page).toHaveURL(/\/erp$/);
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  // Navegación por pestañas del encabezado → sección Administración → módulo Usuarios.
  await openSection(page, /Administración/);
  await expect(page.getByRole('heading', { name: 'Administración', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Usuarios y permisos/ }).click();
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
  await page.getByLabel('Código de 6 dígitos').fill(totp(adminSecret));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page).toHaveURL(/\/erp$/);

  // Desactivar con confirmación dentro de la fila; la persona ya no puede ingresar.
  // Acceso directo desde el Command Center.
  await page
    .getByRole('region', { name: 'Puedes usar' })
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

test('administrador: crea producto, presentaciones y precios', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'El flujo de administración se valida en escritorio');
  test.skip(!adminSecret, 'Requiere el flujo de configuración del segundo factor');

  await signIn(page, 'admin@quatreros.example');
  await page.getByLabel('Código de 6 dígitos').fill(totp(adminSecret));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page).toHaveURL(/\/erp$/);

  await openSection(page, /Producción/);
  await expect(page.getByRole('heading', { name: 'Producción', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Catálogo y precios/ }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo y precios' })).toBeVisible();

  const stamp = String(Date.now());
  const productName = `Chorizo Prueba ${stamp}`;
  await page.getByRole('button', { name: 'Crear producto' }).click();
  const productForm = page.getByRole('form', { name: 'Crear producto' });
  await productForm.getByLabel('Nombre').fill(productName);
  await productForm.getByLabel('Vida útil (días)').fill('30');
  await productForm.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByText(`${productName} quedó en el catálogo.`)).toBeVisible();

  await page.getByRole('link', { name: new RegExp(productName) }).click();
  await expect(page.getByRole('heading', { name: productName })).toBeVisible();

  await page.getByRole('button', { name: 'Agregar presentación' }).click();
  const unitForm = page.getByRole('form', { name: 'Agregar presentación' });
  await unitForm.getByLabel('Nombre').fill('Unidad');
  await unitForm.getByLabel('Unidades base por presentación').fill('1');
  await unitForm.getByRole('button', { name: 'Agregar presentación' }).click();
  await expect(page.getByText('Presentación Unidad agregada.')).toBeVisible();

  await page.getByRole('button', { name: 'Agregar presentación' }).click();
  const packageForm = page.getByRole('form', { name: 'Agregar presentación' });
  await packageForm.getByLabel('Nombre').fill('Paquete x10');
  await packageForm.getByLabel('Unidades base por presentación').fill('10');
  await packageForm.getByRole('button', { name: 'Agregar presentación' }).click();
  await expect(page.getByText('Presentación Paquete x10 agregada.')).toBeVisible();

  await page.getByRole('button', { name: 'Cambiar precio de Unidad' }).click();
  const priceForm = page.getByRole('form', { name: 'Cambiar precio de Unidad' });
  await priceForm.getByLabel('Precio (COP)').fill('1300.00');
  await priceForm.getByRole('button', { name: 'Guardar precio' }).click();
  await expect(page.getByText('Precio de Unidad actualizado.')).toBeVisible();
  await expect(page.getByText(/1\.300/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Ver histórico de precios de Unidad' }).click();
  await expect(page.getByText('Vigente', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Cambiar precio de Unidad' }).click();
  const newPriceForm = page.getByRole('form', { name: 'Cambiar precio de Unidad' });
  await newPriceForm.getByLabel('Precio (COP)').fill('1400.00');
  await newPriceForm.getByRole('button', { name: 'Guardar precio' }).click();
  await expect(page.getByText('Precio de Unidad actualizado.')).toBeVisible();
  await expect(page.getByText(/1\.400/).first()).toBeVisible();
});

test('administrador: crea un traslado y lo recibe', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'El flujo de administración se valida en escritorio');
  test.skip(!adminSecret, 'Requiere el flujo de configuración del segundo factor');

  await signIn(page, 'admin@quatreros.example');
  await page.getByLabel('Código de 6 dígitos').fill(totp(adminSecret));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page).toHaveURL(/\/erp$/);

  await page.goto('/erp/existencias');
  await page.getByRole('tab', { name: 'Traslados' }).click();
  await page.getByRole('button', { name: 'Nuevo traslado' }).click();
  const form = page.getByRole('form', { name: 'Nuevo traslado' });
  await form.getByLabel('Origen').selectOption({ label: 'Principal · Bodega principal' });
  await form.getByLabel('Destino').selectOption({ label: 'Productos del punto · Punto de asados' });
  await form
    .getByLabel('Producto y presentación')
    .selectOption({ label: 'Chorizo Santarrosano · Paquete x10' });
  await form.getByLabel('Cantidad').fill('1');
  await form.getByRole('button', { name: 'Enviar traslado' }).click();

  await expect(page).toHaveURL(/\/erp\/existencias\/traslados\//);
  await expect(page.getByRole('heading', { name: /Traslado T-\d{4}/ })).toBeVisible();
  await expect(page.getByText('En tránsito', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar recepción' }).click();
  await expect(page.getByText('Traslado recibido completo.').first()).toBeVisible();
});
