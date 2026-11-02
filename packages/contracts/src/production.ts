import { z } from 'zod';
import { BusinessDate, PageQuery, Quantity, Uuid, pageOf } from './common.js';
import { BaseUnit } from './catalog.js';

/**
 * Contratos del módulo de producción (especificación prod/produccion).
 * Cantidades en unidad base o en unidades de la presentación, siempre como cadenas decimales.
 * El costo oficial del lote PT está bloqueado (P-03) y no viaja en estos contratos.
 */

const Percentage = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Porcentaje inválido')
  .refine((value) => Number(value) > 0 && Number(value) <= 100, 'El porcentaje debe estar entre 0 y 100');

const Tolerance = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Tolerancia inválida')
  .refine((value) => Number(value) >= 0, 'La tolerancia no puede ser negativa');

const RecipeLineInput = z.object({
  rawMaterialId: Uuid,
  quantity: Quantity,
});

export const RecipeLineView = z.object({
  rawMaterialId: Uuid,
  rawMaterialName: z.string(),
  unit: BaseUnit,
  quantity: Quantity,
});
export type RecipeLineView = z.infer<typeof RecipeLineView>;

export const RecipeVersionSummary = z.object({
  id: Uuid,
  version: z.number().int(),
  baseOutputQty: Quantity,
  expectedYieldPct: Percentage,
  tolerancePct: Tolerance,
  isCurrent: z.boolean(),
  publishedAt: z.iso.datetime({ offset: true }),
});
export type RecipeVersionSummary = z.infer<typeof RecipeVersionSummary>;

export const RecipeVersionView = RecipeVersionSummary.extend({
  lines: z.array(RecipeLineView),
});
export type RecipeVersionView = z.infer<typeof RecipeVersionView>;

export const RecipeSummary = z.object({
  id: Uuid,
  productId: Uuid,
  productName: z.string(),
  baseUnit: BaseUnit,
  currentVersion: RecipeVersionSummary,
});
export type RecipeSummary = z.infer<typeof RecipeSummary>;

export const RecipeDetail = RecipeSummary.extend({
  versions: z.array(RecipeVersionView),
});
export type RecipeDetail = z.infer<typeof RecipeDetail>;

export const CreateRecipeRequest = z.object({
  productId: Uuid,
  baseOutputQty: Quantity,
  expectedYieldPct: Percentage.optional(),
  tolerancePct: Tolerance.optional(),
  lines: z.array(RecipeLineInput).min(1, 'Agrega al menos un ingrediente'),
});
export type CreateRecipeRequest = z.input<typeof CreateRecipeRequest>;

export const CreateRecipeVersionRequest = z.object({
  baseOutputQty: Quantity,
  expectedYieldPct: Percentage.optional(),
  tolerancePct: Tolerance.optional(),
  lines: z.array(RecipeLineInput).min(1, 'Agrega al menos un ingrediente'),
});
export type CreateRecipeVersionRequest = z.input<typeof CreateRecipeVersionRequest>;

export const RecipeListQuery = PageQuery.extend({
  q: z.string().trim().max(120).optional(),
});
export type RecipeListQuery = z.input<typeof RecipeListQuery>;

export const RecipePage = pageOf(RecipeSummary);
export type RecipePage = z.infer<typeof RecipePage>;

export const ProductionOrderStatus = z.enum(['planned', 'in_progress', 'closed']);
export type ProductionOrderStatus = z.infer<typeof ProductionOrderStatus>;

export const PRODUCTION_ORDER_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  planned: 'Planificada',
  in_progress: 'En proceso',
  closed: 'Cerrada',
};

export const TheoreticalConsumption = z.object({
  rawMaterialId: Uuid,
  rawMaterialName: z.string(),
  unit: BaseUnit,
  theoreticalQuantity: Quantity,
  availableQuantity: z.string(),
  sufficient: z.boolean(),
});
export type TheoreticalConsumption = z.infer<typeof TheoreticalConsumption>;

export const ConsumptionView = z.object({
  id: Uuid,
  rawMaterialId: Uuid,
  rawMaterialName: z.string(),
  unit: BaseUnit,
  lotId: Uuid,
  lotCode: z.string(),
  locationId: Uuid,
  locationName: z.string(),
  theoreticalQuantity: Quantity,
  actualQuantity: Quantity,
});
export type ConsumptionView = z.infer<typeof ConsumptionView>;

export const OutputView = z.object({
  id: Uuid,
  presentationId: Uuid,
  presentationName: z.string(),
  quantity: Quantity,
  baseQuantity: Quantity,
});
export type OutputView = z.infer<typeof OutputView>;

export const AvailableLot = z.object({
  lotId: Uuid,
  code: z.string(),
  rawMaterialId: Uuid,
  rawMaterialName: z.string(),
  unit: BaseUnit,
  locationId: Uuid,
  locationName: z.string(),
  available: Quantity,
  expiresOn: BusinessDate.nullable(),
});
export type AvailableLot = z.infer<typeof AvailableLot>;

export const ProductionPreviewQuery = z.object({
  productId: Uuid,
  siteId: Uuid,
  plannedQty: Quantity,
});
export type ProductionPreviewQuery = z.input<typeof ProductionPreviewQuery>;

export const ProductionPreview = z.object({
  recipeVersionId: Uuid,
  recipeVersion: z.number().int(),
  baseOutputQty: Quantity,
  expectedYieldPct: Percentage,
  tolerancePct: Tolerance,
  theoreticalConsumption: z.array(TheoreticalConsumption),
});
export type ProductionPreview = z.infer<typeof ProductionPreview>;

export const ProductionOrderSummary = z.object({
  id: Uuid,
  number: z.string(),
  productId: Uuid,
  productName: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  recipeVersionId: Uuid,
  recipeVersion: z.number().int(),
  plannedQty: Quantity,
  actualQty: Quantity.nullable(),
  yieldPct: z.string().nullable(),
  status: ProductionOrderStatus,
  responsibleId: Uuid,
  responsibleName: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type ProductionOrderSummary = z.infer<typeof ProductionOrderSummary>;

export const ProductionOrderDetail = ProductionOrderSummary.extend({
  expectedYieldPct: Percentage,
  tolerancePct: Tolerance,
  theoreticalConsumption: z.array(TheoreticalConsumption),
  consumptions: z.array(ConsumptionView),
  outputs: z.array(OutputView),
  availableLots: z.array(AvailableLot),
  outputLocation: z.object({ id: Uuid, name: z.string() }).nullable(),
  outputLotId: Uuid.nullable(),
  outputLotCode: z.string().nullable(),
  yieldNote: z.string().nullable(),
});
export type ProductionOrderDetail = z.infer<typeof ProductionOrderDetail>;

export const CreateProductionOrderRequest = z.object({
  productId: Uuid,
  siteId: Uuid,
  plannedQty: Quantity,
});
export type CreateProductionOrderRequest = z.input<typeof CreateProductionOrderRequest>;

export const ConsumeProductionOrderRequest = z.object({
  lines: z
    .array(
      z.object({
        rawMaterialId: Uuid,
        lotId: Uuid,
        locationId: Uuid,
        quantity: Quantity,
      }),
    )
    .min(1, 'Registra al menos un lote consumido'),
});
export type ConsumeProductionOrderRequest = z.input<typeof ConsumeProductionOrderRequest>;

export const CloseProductionOrderRequest = z.object({
  outputs: z
    .array(
      z.object({
        presentationId: Uuid,
        quantity: Quantity,
      }),
    )
    .min(1, 'Registra al menos una presentación producida'),
  yieldNote: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
});
export type CloseProductionOrderRequest = z.input<typeof CloseProductionOrderRequest>;

export const ProductionOrderListQuery = PageQuery.extend({
  status: ProductionOrderStatus.optional(),
  q: z.string().trim().max(120).optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
});
export type ProductionOrderListQuery = z.input<typeof ProductionOrderListQuery>;

export const ProductionOrderPage = pageOf(ProductionOrderSummary);
export type ProductionOrderPage = z.infer<typeof ProductionOrderPage>;
