import { describe, expect, it } from 'vitest';
import {
  AvailabilityQuery,
  LotListQuery,
  MovementListQuery,
  SignedQuantity,
  StockBalanceQuery,
} from './inventory.js';

describe('contratos de inventario', () => {
  it('pagina con 50 por defecto y acepta filtros', () => {
    expect(StockBalanceQuery.parse({})).toMatchObject({ limit: 50 });
    expect(MovementListQuery.parse({})).toMatchObject({ limit: 50 });
    expect(LotListQuery.parse({})).toMatchObject({ limit: 50 });
    expect(AvailabilityQuery.parse({})).toMatchObject({ limit: 100 });
    expect(StockBalanceQuery.parse({ status: 'available', expiresBefore: '2026-11-10' })).toMatchObject({
      status: 'available',
      expiresBefore: '2026-11-10',
    });
  });

  it('rechaza cantidades con signo cero o formato inválido', () => {
    expect(() => SignedQuantity.parse('0')).toThrow();
    expect(() => SignedQuantity.parse('1.2345')).toThrow();
    expect(SignedQuantity.parse('-1.500')).toBe('-1.500');
    expect(SignedQuantity.parse('240.000')).toBe('240.000');
  });

  it('rechaza un estado de lote inexistente', () => {
    expect(() => StockBalanceQuery.parse({ status: 'perdido' })).toThrow();
  });
});
