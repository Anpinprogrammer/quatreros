import { describe, expect, it } from 'vitest';
import { IdempotencyKey, Money, PageQuery, Quantity } from './common.js';

describe('Money (ADR-008)', () => {
  it('acepta cadenas decimales con hasta 2 decimales', () => {
    expect(Money.parse('12000')).toBe('12000');
    expect(Money.parse('12000.50')).toBe('12000.50');
  });
  it('rechaza números, negativos y más de 2 decimales', () => {
    expect(Money.safeParse(12000).success).toBe(false);
    expect(Money.safeParse('-1').success).toBe(false);
    expect(Money.safeParse('1.234').success).toBe(false);
  });
});

describe('Quantity', () => {
  it('acepta hasta 3 decimales y exige > 0', () => {
    expect(Quantity.parse('2.500')).toBe('2.500');
    expect(Quantity.safeParse('0').success).toBe(false);
    expect(Quantity.safeParse('1.2345').success).toBe(false);
  });
});

describe('IdempotencyKey (BR-007)', () => {
  it('exige UUID', () => {
    expect(IdempotencyKey.safeParse('abc').success).toBe(false);
    expect(IdempotencyKey.safeParse('6b1f8b52-2a1d-4c43-9c8a-9a1e2f0d7c11').success).toBe(true);
  });
});

describe('PageQuery', () => {
  it('aplica límite por defecto y máximo de 100', () => {
    expect(PageQuery.parse({}).limit).toBe(50);
    expect(PageQuery.safeParse({ limit: '101' }).success).toBe(false);
  });
});
