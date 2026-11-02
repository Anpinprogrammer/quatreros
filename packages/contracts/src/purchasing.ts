import { z } from 'zod';
import { BusinessDate, Money, PageQuery, Quantity, Uuid, pageOf } from './common.js';
import { BaseUnit } from './catalog.js';

/**
 * Contratos del módulo de compras (especificación comp/compras).
 * El total no incluye impuestos: el desglose fiscal está bloqueado (P-02, BR-044).
 */

/** Costo unitario con hasta 4 decimales, mayor que cero. */
export const UnitCost = z
  .string()
  .regex(/^\d{1,11}(\.\d{1,4})?$/, 'Costo inválido: use una cadena decimal con máximo 4 decimales')
  .refine((value) => Number(value) > 0, 'El costo debe ser mayor que 0')
  .describe('Costo unitario como cadena decimal');

const NonNegativeQuantity = z
  .string()
  .regex(/^\d{1,11}(\.\d{1,3})?$/, 'Cantidad inválida')
  .describe('Cantidad no negativa como cadena decimal');

const SupplierName = z
  .string()
  .trim()
  .min(2, 'Escribe el nombre del proveedor')
  .max(120, 'Máximo 120 caracteres');

const TaxId = z.string().trim().min(3, 'Identificación inválida').max(30, 'Máximo 30 caracteres');
const Phone = z.string().trim().max(30, 'Máximo 30 caracteres');
const ContactName = z.string().trim().max(120, 'Máximo 120 caracteres');

export const SupplierView = z.object({
  id: Uuid,
  name: z.string(),
  taxId: z.string().nullable(),
  phone: z.string().nullable(),
  contactName: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number().int(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type SupplierView = z.infer<typeof SupplierView>;

export const CreateSupplierRequest = z.object({
  name: SupplierName,
  taxId: TaxId.nullish(),
  phone: Phone.nullish(),
  contactName: ContactName.nullish(),
});
export type CreateSupplierRequest = z.input<typeof CreateSupplierRequest>;

export const UpdateSupplierRequest = z
  .object({
    name: SupplierName.optional(),
    taxId: TaxId.nullable().optional(),
    phone: Phone.nullable().optional(),
    contactName: ContactName.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'No hay cambios para guardar');
export type UpdateSupplierRequest = z.input<typeof UpdateSupplierRequest>;

export const SupplierListQuery = PageQuery.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});
export type SupplierListQuery = z.input<typeof SupplierListQuery>;

export const SupplierPage = pageOf(SupplierView);
export type SupplierPage = z.infer<typeof SupplierPage>;

export const PurchaseStatus = z.enum(['pending_receipt', 'partially_received', 'received']);
export type PurchaseStatus = z.infer<typeof PurchaseStatus>;

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending_receipt: 'Pendiente de recepción',
  partially_received: 'Recibida parcialmente',
  received: 'Recibida',
};

export const PurchaseLineView = z.object({
  id: Uuid,
  rawMaterialId: Uuid,
  rawMaterialName: z.string(),
  unit: BaseUnit,
  tracksExpiry: z.boolean(),
  quantity: Quantity,
  unitCost: UnitCost,
  receivedQuantity: NonNegativeQuantity,
  pendingQuantity: NonNegativeQuantity,
});
export type PurchaseLineView = z.infer<typeof PurchaseLineView>;

export const ReceiptLineView = z.object({
  id: Uuid,
  purchaseLineId: Uuid,
  quantity: Quantity,
  lotId: Uuid,
  lotCode: z.string(),
  expiresOn: BusinessDate.nullable(),
});
export type ReceiptLineView = z.infer<typeof ReceiptLineView>;

export const ReceiptView = z.object({
  id: Uuid,
  number: z.string(),
  locationId: Uuid,
  locationName: z.string(),
  receivedAt: z.iso.datetime({ offset: true }),
  receivedByName: z.string().nullable(),
  lines: z.array(ReceiptLineView),
});
export type ReceiptView = z.infer<typeof ReceiptView>;

export const PurchaseSummary = z.object({
  id: Uuid,
  number: z.string(),
  supplierId: Uuid,
  supplierName: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  purchasedOn: BusinessDate,
  total: Money,
  status: PurchaseStatus,
  createdAt: z.iso.datetime({ offset: true }),
  lineCount: z.number().int(),
});
export type PurchaseSummary = z.infer<typeof PurchaseSummary>;

export const ReceptionLocation = z.object({
  id: Uuid,
  name: z.string(),
  kind: z.string(),
});
export type ReceptionLocation = z.infer<typeof ReceptionLocation>;

export const PurchaseDetail = PurchaseSummary.extend({
  lines: z.array(PurchaseLineView),
  receipts: z.array(ReceiptView),
  receptionLocations: z.array(ReceptionLocation),
});
export type PurchaseDetail = z.infer<typeof PurchaseDetail>;

export const CreatePurchaseRequest = z.object({
  supplierId: Uuid,
  siteId: Uuid,
  purchasedOn: BusinessDate.optional(),
  lines: z
    .array(
      z.object({
        rawMaterialId: Uuid,
        quantity: Quantity,
        unitCost: UnitCost,
      }),
    )
    .min(1, 'Agrega al menos una línea'),
});
export type CreatePurchaseRequest = z.input<typeof CreatePurchaseRequest>;

export const ReceivePurchaseRequest = z.object({
  locationId: Uuid,
  lines: z
    .array(
      z.object({
        purchaseLineId: Uuid,
        quantity: Quantity,
        expiresOn: BusinessDate.optional(),
      }),
    )
    .min(1, 'Confirma al menos una línea'),
});
export type ReceivePurchaseRequest = z.input<typeof ReceivePurchaseRequest>;

export const PurchaseListQuery = PageQuery.extend({
  status: PurchaseStatus.optional(),
  supplierId: Uuid.optional(),
  q: z.string().trim().max(120).optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
});
export type PurchaseListQuery = z.input<typeof PurchaseListQuery>;

export const PurchasePage = pageOf(PurchaseSummary);
export type PurchasePage = z.infer<typeof PurchasePage>;
