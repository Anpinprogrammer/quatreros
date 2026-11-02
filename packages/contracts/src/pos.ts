import { z } from 'zod';
import { Money, PageQuery, Quantity, Uuid, pageOf } from './common.js';

/** Contratos de caja, turnos, ventas y recetas de platos (pos/caja). */

/** Monto con signo para diferencias de arqueo. */
export const SignedMoney = z
  .string()
  .regex(/^-?\d{1,12}(\.\d{1,2})?$/, 'Monto inválido: use una cadena decimal con máximo 2 decimales');

export const ShiftStatus = z.enum(['open', 'closed', 'closed_with_variance', 'reviewed']);
export type ShiftStatus = z.infer<typeof ShiftStatus>;
export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  open: 'Abierto',
  closed: 'Cerrado',
  closed_with_variance: 'Cerrado con diferencia',
  reviewed: 'Revisado',
};

export const PaymentMethodView = z.object({
  id: Uuid,
  name: z.string(),
  isCash: z.boolean(),
});
export type PaymentMethodView = z.infer<typeof PaymentMethodView>;

export const PosCatalogItem = z.object({
  productId: Uuid,
  productName: z.string(),
  presentationId: Uuid,
  presentationName: z.string(),
  unitsPer: Quantity,
  kind: z.enum(['manufactured', 'prepared']),
  price: Money,
  available: z.string().nullable(),
  recipeVersionId: Uuid.nullable(),
  sellable: z.boolean(),
  reason: z.string().nullable(),
});
export type PosCatalogItem = z.infer<typeof PosCatalogItem>;

export const PosCatalog = z.object({
  siteId: Uuid,
  siteName: z.string(),
  items: z.array(PosCatalogItem),
  paymentMethods: z.array(PaymentMethodView),
});
export type PosCatalog = z.infer<typeof PosCatalog>;

export const PosCatalogQuery = z.object({ siteId: Uuid.optional() });
export type PosCatalogQuery = z.input<typeof PosCatalogQuery>;

export const ShiftSummary = z.object({
  id: Uuid,
  siteId: Uuid,
  siteName: z.string(),
  cashierUserId: Uuid,
  cashierName: z.string(),
  status: ShiftStatus,
  openingCash: Money,
  openedAt: z.iso.datetime({ offset: true }),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
  cashExpected: Money.nullable(),
  cashCounted: Money.nullable(),
  cashDifference: SignedMoney.nullable(),
  closingNote: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
  reviewNote: z.string().nullable(),
  saleCount: z.number().int(),
  salesTotal: Money,
});
export type ShiftSummary = z.infer<typeof ShiftSummary>;

export const ShiftCountView = z.object({
  paymentMethodId: Uuid,
  paymentMethodName: z.string(),
  isCash: z.boolean(),
  expectedAmount: Money,
  countedAmount: Money,
  difference: SignedMoney,
});
export type ShiftCountView = z.infer<typeof ShiftCountView>;

export const SaleSummary = z.object({
  id: Uuid,
  number: z.string(),
  total: Money,
  changeAmount: Money,
  soldAt: z.iso.datetime({ offset: true }),
  lineCount: z.number().int(),
});
export type SaleSummary = z.infer<typeof SaleSummary>;

export const SaleLineLot = z.object({
  lotId: Uuid,
  lotCode: z.string(),
  quantity: Quantity,
});
export type SaleLineLot = z.infer<typeof SaleLineLot>;

export const SaleLineConsumption = z.object({
  name: z.string(),
  unit: z.string(),
  quantity: Quantity,
});
export type SaleLineConsumption = z.infer<typeof SaleLineConsumption>;

export const SaleLineView = z.object({
  id: Uuid,
  productId: Uuid,
  productName: z.string(),
  presentationId: Uuid,
  presentationName: z.string(),
  kind: z.enum(['manufactured', 'prepared']),
  quantity: Quantity,
  unitPrice: Money,
  lineTotal: Money,
  recipeVersion: z.number().int().nullable(),
  lots: z.array(SaleLineLot),
  consumption: z.array(SaleLineConsumption),
});
export type SaleLineView = z.infer<typeof SaleLineView>;

export const SalePaymentView = z.object({
  paymentMethodId: Uuid,
  paymentMethodName: z.string(),
  isCash: z.boolean(),
  amount: Money,
});
export type SalePaymentView = z.infer<typeof SalePaymentView>;

export const SaleDetail = SaleSummary.extend({
  shiftId: Uuid,
  siteId: Uuid,
  siteName: z.string(),
  cashierUserId: Uuid,
  cashierName: z.string(),
  lines: z.array(SaleLineView),
  payments: z.array(SalePaymentView),
});
export type SaleDetail = z.infer<typeof SaleDetail>;

export const ShiftDetail = ShiftSummary.extend({
  counts: z.array(ShiftCountView),
  sales: z.array(SaleSummary),
});
export type ShiftDetail = z.infer<typeof ShiftDetail>;

export const OpenShiftRequest = z.object({
  siteId: Uuid,
  openingCash: Money,
});
export type OpenShiftRequest = z.input<typeof OpenShiftRequest>;

export const CreateSaleRequest = z.object({
  shiftId: Uuid,
  lines: z.array(z.object({ presentationId: Uuid, quantity: Quantity })).min(1, 'Agrega al menos una línea'),
  payments: z.array(z.object({ paymentMethodId: Uuid, amount: Money })).min(1, 'Registra al menos un pago'),
});
export type CreateSaleRequest = z.input<typeof CreateSaleRequest>;

export const CloseShiftRequest = z.object({
  counts: z
    .array(z.object({ paymentMethodId: Uuid, countedAmount: Money }))
    .min(1, 'Registra el conteo de los medios de pago'),
  note: z.string().trim().max(300).optional(),
});
export type CloseShiftRequest = z.input<typeof CloseShiftRequest>;

export const ReviewShiftRequest = z.object({
  conclusion: z.string().trim().min(3, 'Escribe la conclusión').max(500),
});
export type ReviewShiftRequest = z.input<typeof ReviewShiftRequest>;

export const ShiftListQuery = PageQuery.extend({
  status: ShiftStatus.optional(),
  siteId: Uuid.optional(),
});
export type ShiftListQuery = z.input<typeof ShiftListQuery>;
export const ShiftPage = pageOf(ShiftSummary);
export type ShiftPage = z.infer<typeof ShiftPage>;

const DishComponentInput = z
  .object({
    rawMaterialId: Uuid.optional(),
    presentationId: Uuid.optional(),
    quantity: Quantity,
  })
  .refine(
    (value) => Number(Boolean(value.rawMaterialId)) + Number(Boolean(value.presentationId)) === 1,
    'Indica una materia prima o una presentación, no ambas.',
  );

export const CreateDishRecipeRequest = z.object({
  productId: Uuid,
  baseOutputQty: Quantity.default('1.000'),
  components: z.array(DishComponentInput).min(1, 'Agrega al menos un componente'),
});
export type CreateDishRecipeRequest = z.input<typeof CreateDishRecipeRequest>;

export const CreateDishRecipeVersionRequest = z.object({
  baseOutputQty: Quantity.default('1.000'),
  components: z.array(DishComponentInput).min(1, 'Agrega al menos un componente'),
});
export type CreateDishRecipeVersionRequest = z.input<typeof CreateDishRecipeVersionRequest>;

export const DishRecipeComponentView = z.object({
  rawMaterialId: Uuid.nullable(),
  presentationId: Uuid.nullable(),
  name: z.string(),
  unit: z.string(),
  quantity: Quantity,
});
export type DishRecipeComponentView = z.infer<typeof DishRecipeComponentView>;

export const DishRecipeVersionView = z.object({
  id: Uuid,
  version: z.number().int(),
  baseOutputQty: Quantity,
  isCurrent: z.boolean(),
  publishedAt: z.iso.datetime({ offset: true }),
  components: z.array(DishRecipeComponentView),
});
export type DishRecipeVersionView = z.infer<typeof DishRecipeVersionView>;

export const DishRecipeSummary = z.object({
  id: Uuid,
  productId: Uuid,
  productName: z.string(),
  currentVersion: DishRecipeVersionView,
});
export type DishRecipeSummary = z.infer<typeof DishRecipeSummary>;

export const DishRecipeDetail = DishRecipeSummary.extend({
  versions: z.array(DishRecipeVersionView),
});
export type DishRecipeDetail = z.infer<typeof DishRecipeDetail>;

export const DishRecipeListQuery = PageQuery.extend({
  q: z.string().trim().max(120).optional(),
});
export type DishRecipeListQuery = z.input<typeof DishRecipeListQuery>;
export const DishRecipePage = pageOf(DishRecipeSummary);
export type DishRecipePage = z.infer<typeof DishRecipePage>;
