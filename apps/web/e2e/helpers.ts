import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? '';

export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto('/ingresar');
  // El ingreso abre con la selección de perfil: se elige Administrador para llegar al formulario.
  const role = page.getByRole('button', { name: /Administrador/ }).first();
  const emailField = page.getByLabel('Correo');
  await role.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
  if (await role.isVisible()) {
    await role.click();
    await page.getByRole('heading', { name: 'Ingresa a tu operación' }).waitFor();
  }
  await expect(emailField).toBeVisible();
  await emailField.fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /^Ingresar/ }).click();
}

/**
 * Navega a una sección del ERP. En escritorio la barra lateral está visible; en tableta y
 * celular se abre el panel de navegación (patrón drawer) antes de elegir el destino.
 */
export async function openSection(page: Page, name: RegExp | string) {
  const trigger = page.getByRole('button', { name: 'Abrir navegación' });
  if (await trigger.isVisible()) {
    await trigger.click();
  }
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name }).click();
}

export async function signOut(page: Page) {
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/ingresar/);
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Código TOTP (RFC 6238) a partir de la clave manual que muestra la pantalla. */
export function totp(secretBase32: string): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(buf).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}
