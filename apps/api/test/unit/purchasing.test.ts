import { describe, expect, it } from 'vitest';
import {
  expiryViolation,
  pendingQuantity,
  purchaseStatus,
  purchaseTotal,
} from '../../src/modules/purchasing/domain/purchasing.js';

describe('total de compra (RF-051)', () => {
  it('suma cantidad por costo unitario y redondea a dos decimales', () => {
    expect(
      purchaseTotal([
        { quantity: '40.000', unitCost: '18000.0000' },
        { quantity: '20.000', unitCost: '14000.0000' },
      ]),
    ).toBe('1000000.00');
    expect(purchaseTotal([{ quantity: '2.500', unitCost: '1234.5678' }])).toBe('3086.42');
  });
});

describe('estado de la compra (BR-043, DEC-094)', () => {
  it('empieza pendiente, pasa a parcial y termina recibida', () => {
    expect(purchaseStatus([{ quantity: '40', receivedQuantity: '0' }])).toBe('pending_receipt');
    expect(
      purchaseStatus([
        { quantity: '40', receivedQuantity: '25.000' },
        { quantity: '20', receivedQuantity: '0' },
      ]),
    ).toBe('partially_received');
    expect(
      purchaseStatus([
        { quantity: '40', receivedQuantity: '40.000' },
        { quantity: '20', receivedQuantity: '20.000' },
      ]),
    ).toBe('received');
  });

  it('calcula el pendiente y no lo deja negativo', () => {
    expect(pendingQuantity('40.000', '25.000')).toBe('15.000');
    expect(pendingQuantity('40.000', '40.000')).toBe('0.000');
  });
});

describe('vencimiento de la materia prima (RF-052)', () => {
  it('exige vencimiento solo cuando la materia prima lo controla', () => {
    expect(expiryViolation(undefined, true, '2026-11-02')).toBe('EXPIRY_REQUIRED');
    expect(expiryViolation(undefined, false, '2026-11-02')).toBeNull();
  });

  it('rechaza un vencimiento anterior a hoy y acepta hoy', () => {
    expect(expiryViolation('2026-11-01', true, '2026-11-02')).toBe('EXPIRY_IN_PAST');
    expect(expiryViolation('2026-11-02', true, '2026-11-02')).toBeNull();
    expect(expiryViolation(null, false, '2026-11-02')).toBeNull();
  });
});
