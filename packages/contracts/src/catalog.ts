import { z } from 'zod';
import { Money, PageQuery, Quantity, Uuid, pageOf } from './common.js';

/**
 * Contratos del módulo de catálogo (especificación cat/catalogo).
 * Dinero y cantidades viajan como cadenas decimales (DEC-P22).
 */

export const BASE_UNITS = ['unidad', 'kg', 'g', 'l', 'ml', 'm'] as const;
export const BaseUnit = z.enum(BASE_UNITS);
export type BaseUnit = z.infer<typeof BaseUnit>;

export const BASE_UNIT_LABELS: Record<BaseUnit, string> = {
  unidad: 'Unidad',
  kg: 'Kilogramo (kg)',
  g: 'Gramo (g)',
  l: 'Litro (l)',
  ml: 'Mililitro (ml)',
  m: 'Metro (m)',
};

export const ProductKind = z.enum(['manufactured', 'prepared']);
export type ProductKind = z.infer<typeof ProductKind>;

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  manufactured: 'Fabricado',
  prepared: 'Preparado',
};

const CatalogName = z
  .string()
  .trim()
  .min(2, 'Escribe un nombre de al menos 2 caracteres')
  .max(120, 'Máximo 120 caracteres');

const ShelfLifeDays = z
  .number()
  .int('La vida útil debe ser un número entero de días')
  .min(1, 'La vida útil debe ser al menos 1 día')
  .max(3650, 'La vida útil no puede superar 10 años');

const PositiveMoney = Money.refine((v) => Number(v) > 0, 'El precio debe ser mayor que 0');

export const PresentationView = z.object({
  id: Uuid,
  name: z.string(),
  unitsPer: Quantity,
  isActive: z.boolean(),
  version: z.number().int(),
  currentPrice: Money.nullable(),
});
export type PresentationView = z.infer<typeof PresentationView>;

export const ProductView = z.object({
  id: Uuid,
  name: z.string(),
  kind: ProductKind,
  baseUnit: BaseUnit,
  shelfLifeDays: z.number().int().nullable(),
  isActive: z.boolean(),
  version: z.number().int(),
  presentations: z.array(PresentationView),
});
export type ProductView = z.infer<typeof ProductView>;

export const PriceView = z.object({
  id: Uuid,
  presentationId: Uuid,
  price: Money,
  validFrom: z.iso.datetime({ offset: true }),
  validTo: z.iso.datetime({ offset: true }).nullable(),
  setBy: Uuid,
  createdAt: z.iso.datetime({ offset: true }),
});
export type PriceView = z.infer<typeof PriceView>;

export const RawMaterialView = z.object({
  id: Uuid,
  name: z.string(),
  unit: BaseUnit,
  tracksExpiry: z.boolean(),
  isActive: z.boolean(),
  version: z.number().int(),
});
export type RawMaterialView = z.infer<typeof RawMaterialView>;

export const CreateProductRequest = z
  .object({
    name: CatalogName,
    kind: ProductKind,
    baseUnit: BaseUnit.default('unidad'),
    shelfLifeDays: ShelfLifeDays.nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'manufactured' && value.shelfLifeDays == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['shelfLifeDays'],
        message: 'Un producto fabricado necesita vida útil en días',
      });
    }
    if (value.kind === 'prepared' && value.shelfLifeDays != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['shelfLifeDays'],
        message: 'Un producto preparado no lleva vida útil',
      });
    }
  });
export type CreateProductRequest = z.input<typeof CreateProductRequest>;

export const UpdateProductRequest = z
  .object({
    name: CatalogName.optional(),
    baseUnit: BaseUnit.optional(),
    shelfLifeDays: ShelfLifeDays.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'No hay cambios para guardar');
export type UpdateProductRequest = z.input<typeof UpdateProductRequest>;

export const CreatePresentationRequest = z.object({
  name: CatalogName,
  unitsPer: Quantity,
});
export type CreatePresentationRequest = z.input<typeof CreatePresentationRequest>;

export const UpdatePresentationRequest = z
  .object({
    name: CatalogName.optional(),
    unitsPer: Quantity.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'No hay cambios para guardar');
export type UpdatePresentationRequest = z.input<typeof UpdatePresentationRequest>;

export const SetPriceRequest = z.object({ price: PositiveMoney });
export type SetPriceRequest = z.input<typeof SetPriceRequest>;

export const CreateRawMaterialRequest = z.object({
  name: CatalogName,
  unit: BaseUnit,
  tracksExpiry: z.boolean().default(false),
});
export type CreateRawMaterialRequest = z.input<typeof CreateRawMaterialRequest>;

export const UpdateRawMaterialRequest = z
  .object({
    name: CatalogName.optional(),
    unit: BaseUnit.optional(),
    tracksExpiry: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'No hay cambios para guardar');
export type UpdateRawMaterialRequest = z.input<typeof UpdateRawMaterialRequest>;

export const ProductListQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  kind: ProductKind.optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});
export type ProductListQuery = z.input<typeof ProductListQuery>;

export const RawMaterialListQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});
export type RawMaterialListQuery = z.input<typeof RawMaterialListQuery>;

export const ProductPage = pageOf(ProductView);
export type ProductPage = z.infer<typeof ProductPage>;
export const RawMaterialPage = pageOf(RawMaterialView);
export type RawMaterialPage = z.infer<typeof RawMaterialPage>;
export const PriceList = z.object({ data: z.array(PriceView) });
export type PriceList = z.infer<typeof PriceList>;
