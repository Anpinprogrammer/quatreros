import { describe, expect, it } from 'vitest';
import {
  agingBucket,
  allocationSum,
  allocateFifo,
  money,
  overdueDays,
  receivableStatus,
  reconciliationStatus,
  toCsv,
} from '../../src/modules/finance/domain/finance.js';

/** Reglas puras de cartera, antigüedad y conciliación (DEC-104). */
describe('antigüedad de cartera (D1, D8)', () => {
  const asOf = '2026-11-02';

  it('agrupa por vencer y vencida 1–30, 31–60, 61–90 y +90', () => {
    expect(agingBucket('2026-11-02', asOf)).toBe('due');
    expect(agingBucket('2026-11-10', asOf)).toBe('due');
    expect(agingBucket('2026-11-01', asOf)).toBe('overdue_1_30');
    expect(agingBucket('2026-10-03', asOf)).toBe('overdue_1_30');
    expect(agingBucket('2026-10-02', asOf)).toBe('overdue_31_60');
    expect(agingBucket('2026-09-03', asOf)).toBe('overdue_31_60');
    expect(agingBucket('2026-09-02', asOf)).toBe('overdue_61_90');
    expect(agingBucket('2026-08-04', asOf)).toBe('overdue_61_90');
    expect(agingBucket('2026-08-03', asOf)).toBe('overdue_90_plus');
  });

  it('no cuenta días negativos como vencimiento', () => {
    expect(overdueDays('2026-11-10', asOf)).toBe(0);
    expect(overdueDays('2026-10-28', asOf)).toBe(5);
  });
});

describe('abonos y estado de obligación', () => {
  it('calcula el estado según el saldo', () => {
    expect(receivableStatus('100.00', '100.00')).toBe('open');
    expect(receivableStatus('100.00', '40.00')).toBe('partially_paid');
    expect(receivableStatus('100.00', '0.00')).toBe('paid');
  });

  it('suma asignaciones con dos decimales', () => {
    expect(allocationSum([{ amount: '10.005' }, { amount: '0.004' }])).toBe('10.01');
  });

  it('aplica FIFO y devuelve el remanente', () => {
    const open = [
      { receivableId: 'a', balance: '30.00' },
      { receivableId: 'b', balance: '50.00' },
      { receivableId: 'c', balance: '20.00' },
    ];
    const partial = allocateFifo('45.00', open);
    expect(partial.allocations).toEqual([
      { receivableId: 'a', amount: '30.00' },
      { receivableId: 'b', amount: '15.00' },
    ]);
    expect(partial.remainder).toBe('0.00');

    const exact = allocateFifo('100.00', open);
    expect(exact.allocations).toHaveLength(3);
    expect(exact.remainder).toBe('0.00');

    const excess = allocateFifo('120.00', open);
    expect(excess.remainder).toBe('20.00');
  });

  it('formatea montos con redondeo comercial', () => {
    expect(money('1234.565')).toBe('1234.57');
    expect(money(10)).toBe('10.00');
  });

  it('marca la conciliación con o sin diferencia', () => {
    expect(reconciliationStatus('0.00')).toBe('reconciled');
    expect(reconciliationStatus('-1000.00')).toBe('reconciled_with_variance');
  });
});

describe('exportación CSV (D6)', () => {
  it('usa BOM, separador ; y comillas solo cuando hace falta', () => {
    const csv = toCsv([
      ['Cliente', 'Monto', 'Nota'],
      ['Restaurante La Brasa', '100.00', 'Sin novedad'],
      ['Tienda "Doña Rosa"', '50.00', 'Falta; revisar'],
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Restaurante La Brasa;100.00;Sin novedad');
    expect(csv).toContain('"Tienda ""Doña Rosa""";50.00;"Falta; revisar"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
