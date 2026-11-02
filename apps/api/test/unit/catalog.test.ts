import { describe, expect, it } from 'vitest';
import {
  canChangeComposition,
  canChangeUnit,
  priceChangeAt,
  priceEligibility,
  shelfLifeIsValid,
} from '../../src/modules/catalog/domain/catalog.js';

/** Reglas puras del catálogo (especificación cat/catalogo §7). */
describe('vida útil (DEC-090)', () => {
  it('un fabricado exige días positivos', () => {
    expect(shelfLifeIsValid('manufactured', 30)).toBe(true);
    expect(shelfLifeIsValid('manufactured', 0)).toBe(false);
    expect(shelfLifeIsValid('manufactured', null)).toBe(false);
    expect(shelfLifeIsValid('manufactured', undefined)).toBe(false);
  });

  it('un preparado no lleva vida útil', () => {
    expect(shelfLifeIsValid('prepared', null)).toBe(true);
    expect(shelfLifeIsValid('prepared', 10)).toBe(false);
  });
});

describe('inmutabilidad con existencias (BR-021, RF-031)', () => {
  it('la unidad y la composición solo cambian sin existencias ni movimientos', () => {
    expect(canChangeUnit(false)).toBe(true);
    expect(canChangeUnit(true)).toBe(false);
    expect(canChangeComposition(false)).toBe(true);
    expect(canChangeComposition(true)).toBe(false);
  });
});

describe('elegibilidad de precio (RF-032)', () => {
  it('exige producto y presentación activos', () => {
    expect(priceEligibility(true, true)).toBe('ok');
    expect(priceEligibility(false, true)).toBe('product_inactive');
    expect(priceEligibility(true, false)).toBe('presentation_inactive');
  });
});

describe('cambio de precio (BR-022, BR-023)', () => {
  it('cierra y abre en el mismo instante', () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    expect(priceChangeAt(now)).toEqual({ closedAt: now, openedAt: now });
  });

  it('si el precio anterior se abrió en el mismo instante, avanza 1 ms', () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    const { closedAt, openedAt } = priceChangeAt(now, now);
    expect(openedAt.getTime()).toBe(now.getTime() + 1);
    expect(closedAt).toEqual(openedAt);
  });
});
