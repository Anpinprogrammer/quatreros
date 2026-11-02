import { z } from 'zod';
import { BusinessDate, PageQuery, Quantity, Uuid, pageOf } from './common.js';
import { BaseUnit } from './catalog.js';

/**
 * Contratos del módulo de inventarios (especificación inv/existencias).
 * Cantidades como cadenas decimales; el kardex y los saldos son de solo lectura en 2b.
 */

export const LotType = z.enum(['raw_material', 'finished_good']);
export type LotType = z.infer<typeof LotType>;

export const LotStatus = z.enum(['available', 'in_inspection', 'blocked', 'expired', 'written_off']);
export type LotStatus = z.infer<typeof LotStatus>;

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  available: 'Disponible',
  in_inspection: 'En inspección',
  blocked: 'Bloqueado',
  expired: 'Vencido',
  written_off: 'Dado de baja',
};

export const MovementType = z.enum([
  'receipt',
  'production_consumption',
  'production_output',
  'transfer_out',
  'transfer_in',
  'dispatch_out',
  'dispatch_return',
  'sale',
  'customer_return',
  'return_reinstated',
  'write_off',
  'adjustment',
  'package_open_out',
  'package_open_in',
  'opening_balance',
  'reversal',
]);
export type MovementType = z.infer<typeof MovementType>;

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  receipt: 'Recepción',
  production_consumption: 'Consumo de producción',
  production_output: 'Producción',
  transfer_out: 'Salida por traslado',
  transfer_in: 'Entrada por traslado',
  dispatch_out: 'Salida por despacho',
  dispatch_return: 'Devolución de despacho',
  sale: 'Venta',
  customer_return: 'Devolución de cliente',
  return_reinstated: 'Reincorporación',
  write_off: 'Baja',
  adjustment: 'Ajuste',
  package_open_out: 'Apertura de paquete (salida)',
  package_open_in: 'Apertura de paquete (entrada)',
  opening_balance: 'Carga inicial',
  reversal: 'Reversión',
};

export const ItemKind = z.enum(['product', 'raw_material']);
export type ItemKind = z.infer<typeof ItemKind>;

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  product: 'Producto',
  raw_material: 'Materia prima',
};

/** Cantidad con signo (entradas positivas, salidas negativas), hasta 3 decimales. */
export const SignedQuantity = z
  .string()
  .regex(/^-?\d{1,11}(\.\d{1,3})?$/, 'Cantidad inválida')
  .refine((value) => Number(value) !== 0, 'La cantidad no puede ser cero')
  .describe('Cantidad con signo como cadena decimal');

export const StockBalanceView = z.object({
  lotId: Uuid,
  lotCode: z.string(),
  lotStatus: LotStatus,
  itemKind: ItemKind,
  itemId: Uuid,
  itemName: z.string(),
  presentationId: Uuid.nullable(),
  presentationName: z.string().nullable(),
  locationId: Uuid,
  locationName: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  quantity: Quantity,
  baseUnit: BaseUnit,
  manufacturedOn: BusinessDate.nullable(),
  expiresOn: BusinessDate.nullable(),
  isExpired: z.boolean(),
  isSellable: z.boolean(),
});
export type StockBalanceView = z.infer<typeof StockBalanceView>;

export const AvailabilityView = z.object({
  itemKind: ItemKind,
  itemId: Uuid,
  itemName: z.string(),
  presentationId: Uuid.nullable(),
  presentationName: z.string().nullable(),
  locationId: Uuid,
  locationName: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  available: Quantity,
  nearestExpiry: BusinessDate.nullable(),
  lotCount: z.number().int(),
});
export type AvailabilityView = z.infer<typeof AvailabilityView>;

export const LotSummary = z.object({
  id: Uuid,
  code: z.string(),
  lotType: LotType,
  itemKind: ItemKind,
  itemId: Uuid,
  itemName: z.string(),
  status: LotStatus,
  manufacturedOn: BusinessDate.nullable(),
  expiresOn: BusinessDate.nullable(),
  isExpired: z.boolean(),
  totalQuantity: Quantity,
  baseUnit: BaseUnit,
  createdAt: z.iso.datetime({ offset: true }),
});
export type LotSummary = z.infer<typeof LotSummary>;

export const StockMovementView = z.object({
  id: z.string(),
  movementType: MovementType,
  lotId: Uuid,
  lotCode: z.string(),
  itemKind: ItemKind,
  itemId: Uuid,
  itemName: z.string(),
  presentationId: Uuid.nullable(),
  presentationName: z.string().nullable(),
  locationId: Uuid,
  locationName: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  quantity: SignedQuantity,
  baseQuantity: SignedQuantity,
  baseUnit: BaseUnit,
  sourceType: z.string(),
  sourceId: Uuid,
  reason: z.string().nullable(),
  createdBy: Uuid,
  createdByName: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type StockMovementView = z.infer<typeof StockMovementView>;

export const LotDetail = LotSummary.extend({
  balances: z.array(StockBalanceView),
  movements: z.array(StockMovementView),
});
export type LotDetail = z.infer<typeof LotDetail>;

export const TraceInput = z.object({
  lotId: Uuid,
  code: z.string(),
  itemName: z.string(),
  quantity: Quantity,
});

export const TraceForward = z.object({
  movementId: z.string(),
  movementType: MovementType,
  quantity: SignedQuantity,
  sourceType: z.string(),
  sourceId: Uuid,
  createdAt: z.iso.datetime({ offset: true }),
});

export const TraceabilityView = z.object({
  lot: LotSummary,
  backward: z.object({
    inputs: z.array(TraceInput),
    supplier: z.object({ id: Uuid, name: z.string() }).nullable(),
    pending: z.array(z.string()),
  }),
  forward: z.object({
    movements: z.array(TraceForward),
    pending: z.array(z.string()),
  }),
});
export type TraceabilityView = z.infer<typeof TraceabilityView>;

export const InventorySummary = z.object({
  productsWithStock: z.number().int(),
  rawMaterialsWithStock: z.number().int(),
  lotsNearExpiry: z.number().int(),
  expiredLots: z.number().int(),
  locationsWithStock: z.number().int(),
});
export type InventorySummary = z.infer<typeof InventorySummary>;

export const StockBalanceQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  productId: Uuid.optional(),
  rawMaterialId: Uuid.optional(),
  presentationId: Uuid.optional(),
  lotId: Uuid.optional(),
  locationId: Uuid.optional(),
  status: LotStatus.optional(),
  expiresBefore: BusinessDate.optional(),
});
export type StockBalanceQuery = z.input<typeof StockBalanceQuery>;

export const AvailabilityQuery = z.object({
  q: z.string().trim().max(100).optional(),
  productId: Uuid.optional(),
  rawMaterialId: Uuid.optional(),
  presentationId: Uuid.optional(),
  locationId: Uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type AvailabilityQuery = z.input<typeof AvailabilityQuery>;

export const LotListQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: LotStatus.optional(),
  expiresBefore: BusinessDate.optional(),
  productId: Uuid.optional(),
  rawMaterialId: Uuid.optional(),
});
export type LotListQuery = z.input<typeof LotListQuery>;

export const MovementListQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  lotId: Uuid.optional(),
  locationId: Uuid.optional(),
  movementType: MovementType.optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
});
export type MovementListQuery = z.input<typeof MovementListQuery>;

export const StockBalancePage = pageOf(StockBalanceView);
export type StockBalancePage = z.infer<typeof StockBalancePage>;
export const AvailabilityList = z.object({ data: z.array(AvailabilityView) });
export type AvailabilityList = z.infer<typeof AvailabilityList>;
export const LotPage = pageOf(LotSummary);
export type LotPage = z.infer<typeof LotPage>;
export const MovementPage = pageOf(StockMovementView);
export type MovementPage = z.infer<typeof MovementPage>;
