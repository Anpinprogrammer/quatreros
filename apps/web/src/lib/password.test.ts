import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword } from './password';

describe('generateTemporaryPassword', () => {
  it('cumple el mínimo de 12 caracteres y evita caracteres ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(pw.length).toBeGreaterThanOrEqual(12);
      expect(pw).not.toMatch(/[01lIoO]/);
    }
  });

  it('no repite contraseñas', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateTemporaryPassword()));
    expect(set.size).toBe(500);
  });
});
