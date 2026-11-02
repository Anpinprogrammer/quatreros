import { describe, expect, it } from 'vitest';
import {
  CreatePresentationRequest,
  CreateProductRequest,
  ProductListQuery,
  SetPriceRequest,
} from './catalog.js';

describe('contratos de catálogo', () => {
  it('un fabricado exige vida útil', () => {
    expect(() =>
      CreateProductRequest.parse({ name: 'Chorizo', kind: 'manufactured', baseUnit: 'unidad' }),
    ).toThrow();
  });

  it('un preparado no lleva vida útil', () => {
    expect(() =>
      CreateProductRequest.parse({
        name: 'Picada',
        kind: 'prepared',
        baseUnit: 'unidad',
        shelfLifeDays: 10,
      }),
    ).toThrow();
    expect(
      CreateProductRequest.parse({ name: 'Picada', kind: 'prepared', baseUnit: 'unidad' }),
    ).toMatchObject({ name: 'Picada', kind: 'prepared', baseUnit: 'unidad' });
  });

  it('no acepta presentaciones ni precios en cero', () => {
    expect(() => CreatePresentationRequest.parse({ name: 'Unidad', unitsPer: '0' })).toThrow();
    expect(() => SetPriceRequest.parse({ price: '0' })).toThrow();
    expect(() => SetPriceRequest.parse({ price: '12000.00' })).not.toThrow();
  });

  it('el listado filtra activos por defecto y pagina con 50', () => {
    expect(ProductListQuery.parse({})).toMatchObject({ status: 'active', limit: 50 });
  });
});
