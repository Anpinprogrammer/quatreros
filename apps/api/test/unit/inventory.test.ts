import { describe, expect, it } from 'vitest';
import {
  baseQuantityFor,
  businessToday,
  compareFefo,
  isExpired,
  isSellable,
  movementViolation,
  nextBalance,
} from '../../src/modules/inventory/domain/inventory.js';

describe('movimientos de inventario (BR-081, ADR-009)', () => {
  it('rechaza cantidad cero y signos distintos', () => {
    expect(movementViolation('0', '0')).toBe('ZERO_QUANTITY');
    expect(movementViolation('5', '-5')).toBe('SIGN_MISMATCH');
    expect(movementViolation('-5', '5')).toBe('SIGN_MISMATCH');
  });

  it('rechaza salidas que dejarían saldo negativo', () => {
    expect(movementViolation('-10', '-10', '5')).toBe('INSUFFICIENT_STOCK');
    expect(movementViolation('-5', '-5', '10')).toBeNull();
    expect(movementViolation('5', '5', '0')).toBeNull();
  });

  it('calcula el saldo y la cantidad base con precisión decimal', () => {
    expect(nextBalance('10.500', '-3.250')).toBe('7.250');
    expect(nextBalance('0', '120')).toBe('120.000');
    expect(baseQuantityFor('24', '10')).toBe('240.000');
  });
});

describe('vencimiento y disponible (BR-085, BR-086)', () => {
  it('un lote vencido no es vendible', () => {
    expect(isExpired('2026-11-05', '2026-11-06')).toBe(true);
    expect(isExpired(null, '2026-11-06')).toBe(false);
    expect(isSellable('available', '2026-11-05', '2026-11-06')).toBe(false);
    expect(isSellable('available', '2026-11-06', '2026-11-06')).toBe(true);
    expect(isSellable('blocked', '2027-01-01', '2026-11-06')).toBe(false);
  });
});

describe('orden FEFO (BR-083)', () => {
  it('ordena por vencimiento y deja los sin vencimiento al final', () => {
    const items = [
      { code: 'B', expiresOn: '2026-11-15' },
      { code: 'A', expiresOn: '2026-11-10' },
      { code: 'C', expiresOn: null },
    ];
    expect(items.toSorted(compareFefo).map((i) => i.code)).toEqual(['A', 'B', 'C']);
  });

  it('desempata por código de lote', () => {
    const items = [
      { code: 'PT-0002', expiresOn: '2026-11-10' },
      { code: 'PT-0001', expiresOn: '2026-11-10' },
    ];
    expect(items.toSorted(compareFefo).map((i) => i.code)).toEqual(['PT-0001', 'PT-0002']);
  });
});

describe('fecha de negocio', () => {
  it('usa America/Bogota, no UTC', () => {
    expect(businessToday(new Date('2026-11-03T03:00:00.000Z'))).toBe('2026-11-02');
    expect(businessToday(new Date('2026-11-02T15:00:00.000Z'))).toBe('2026-11-02');
  });
});
