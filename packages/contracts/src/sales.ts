import { z } from 'zod';
import { BusinessDate, Money, PageQuery, Quantity, Uuid, pageOf } from './common.js';

/** Contratos de clientes, pedidos, despachos y reparto (com/pedidos-reparto). */

export const CustomerKind = z.enum(['restaurant', 'business', 'individual']);
export type CustomerKind = z.infer<typeof CustomerKind>;

export const CUSTOMER_KIND_LABELS: Record<CustomerKind, string> = {
  restaurant: 'Restaurante',
  business: 'Negocio',
  individual: 'Persona natural',
};

export const CustomerView = z.object({
  id: Uuid,
  kind: CustomerKind,
  name: z.string(),
  taxId: z.string().nullable(),
  phone: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number().int(),
  credit: z
    .object({
      enabled: z.boolean(),
      creditLimit: Money,
      termDays: z.number().int(),
    })
    .nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type CustomerView = z.infer<typeof CustomerView>;

const CustomerName = z.string().trim().min(2, 'Escribe el nombre').max(120);
const TaxId = z.string().trim().min(3).max(30);
const Phone = z.string().trim().max(30);
const Address = z.string().trim().max(240);
const CreditLimit = Money;
const TermDays = z.number().int().min(0).max(365);

export const CreateCustomerRequest = z.object({
  kind: CustomerKind,
  name: CustomerName,
  taxId: TaxId.nullish(),
  phone: Phone.nullish(),
  deliveryAddress: Address.nullish(),
});
export type CreateCustomerRequest = z.input<typeof CreateCustomerRequest>;

export const UpdateCustomerRequest = z
  .object({
    kind: CustomerKind.optional(),
    name: CustomerName.optional(),
    taxId: TaxId.nullable().optional(),
    phone: Phone.nullable().optional(),
    deliveryAddress: Address.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'No hay cambios para guardar');
export type UpdateCustomerRequest = z.input<typeof UpdateCustomerRequest>;

export const UpdateCreditRequest = z.object({
  enabled: z.boolean(),
  creditLimit: CreditLimit,
  termDays: TermDays,
});
export type UpdateCreditRequest = z.input<typeof UpdateCreditRequest>;

export const CustomerListQuery = PageQuery.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});
export type CustomerListQuery = z.input<typeof CustomerListQuery>;
export const CustomerPage = pageOf(CustomerView);
export type CustomerPage = z.infer<typeof CustomerPage>;

export const SALES_CHANNELS = ['whatsapp', 'phone', 'in_person', 'other'] as const;
export const SalesChannel = z.enum(SALES_CHANNELS);
export type SalesChannel = z.infer<typeof SalesChannel>;
export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Teléfono',
  in_person: 'Presencial',
  other: 'Otro',
};

export const PaymentMode = z.enum(['cash_on_delivery', 'credit']);
export type PaymentMode = z.infer<typeof PaymentMode>;
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash_on_delivery: 'Contraentrega',
  credit: 'Crédito',
};

export const SalesOrderStatus = z.enum(['confirmed', 'in_dispatch', 'partially_delivered', 'delivered']);
export type SalesOrderStatus = z.infer<typeof SalesOrderStatus>;
export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  confirmed: 'Confirmado',
  in_dispatch: 'En despacho',
  partially_delivered: 'Entregado parcial',
  delivered: 'Entregado',
};

export const PaymentMethod = z.enum(['cash', 'transfer']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export const SalesOrderLineView = z.object({
  id: Uuid,
  presentationId: Uuid,
  presentationName: z.string(),
  itemName: z.string(),
  orderedQty: Quantity,
  reservedQty: z.string(),
  deliveredQty: z.string(),
  returnedQty: z.string(),
  pendingQty: z.string(),
  unitPrice: Money,
  lineTotal: Money,
});
export type SalesOrderLineView = z.infer<typeof SalesOrderLineView>;

export const SalesOrderSummary = z.object({
  id: Uuid,
  number: z.string(),
  customerId: Uuid,
  customerName: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  channel: SalesChannel,
  paymentMode: PaymentMode,
  requestedDate: BusinessDate.nullable(),
  status: SalesOrderStatus,
  total: Money,
  creditWarning: z.string().nullable(),
  confirmedAt: z.iso.datetime({ offset: true }),
  lineCount: z.number().int(),
});
export type SalesOrderSummary = z.infer<typeof SalesOrderSummary>;

export const SalesOrderDetail = SalesOrderSummary.extend({
  lines: z.array(SalesOrderLineView),
});
export type SalesOrderDetail = z.infer<typeof SalesOrderDetail>;

export const CreateSalesOrderRequest = z.object({
  customerId: Uuid,
  siteId: Uuid,
  channel: SalesChannel,
  paymentMode: PaymentMode,
  requestedDate: BusinessDate.optional(),
  lines: z.array(z.object({ presentationId: Uuid, quantity: Quantity })).min(1, 'Agrega al menos una línea'),
});
export type CreateSalesOrderRequest = z.input<typeof CreateSalesOrderRequest>;

export const SalesOrderListQuery = PageQuery.extend({
  status: SalesOrderStatus.optional(),
  customerId: Uuid.optional(),
  q: z.string().trim().max(120).optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
});
export type SalesOrderListQuery = z.input<typeof SalesOrderListQuery>;
export const SalesOrderPage = pageOf(SalesOrderSummary);
export type SalesOrderPage = z.infer<typeof SalesOrderPage>;

export const DispatchStatus = z.enum(['prepared', 'in_route', 'to_settle']);
export type DispatchStatus = z.infer<typeof DispatchStatus>;
export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  prepared: 'Preparado',
  in_route: 'En ruta',
  to_settle: 'Por liquidar',
};

export const DispatchOrderView = z.object({
  orderId: Uuid,
  orderNumber: z.string(),
  customerName: z.string(),
  deliveryAddress: z.string().nullable(),
  phone: z.string().nullable(),
  paymentMode: PaymentMode,
  total: Money,
  lines: z.array(
    z.object({
      dispatchLineId: Uuid,
      orderLineId: Uuid,
      presentationName: z.string(),
      itemName: z.string(),
      lotId: Uuid,
      lotCode: z.string(),
      loadedQty: Quantity,
      deliveredQty: z.string(),
      returnedQty: z.string(),
      unitPrice: Money,
      pendingQty: z.string(),
    }),
  ),
});
export type DispatchOrderView = z.infer<typeof DispatchOrderView>;

export const DispatchSummary = z.object({
  id: Uuid,
  number: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  driverId: Uuid,
  driverName: z.string(),
  dispatchDate: BusinessDate,
  status: DispatchStatus,
  orderCount: z.number().int(),
  loadedTotal: Quantity,
  deliveredTotal: Quantity,
  createdAt: z.iso.datetime({ offset: true }),
});
export type DispatchSummary = z.infer<typeof DispatchSummary>;

export const DispatchDetail = DispatchSummary.extend({
  routeLocationName: z.string().nullable(),
  orders: z.array(DispatchOrderView),
  returns: z.array(
    z.object({
      id: Uuid,
      number: z.string(),
      lotCode: z.string(),
      quantity: Quantity,
      reason: z.string(),
      status: z.enum(['in_inspection', 'reinstated']),
    }),
  ),
});
export type DispatchDetail = z.infer<typeof DispatchDetail>;

export const CreateDispatchRequest = z.object({
  siteId: Uuid,
  driverId: Uuid,
  dispatchDate: BusinessDate,
  orderIds: z.array(Uuid).min(1, 'Selecciona al menos un pedido'),
});
export type CreateDispatchRequest = z.input<typeof CreateDispatchRequest>;

export const DispatchListQuery = PageQuery.extend({
  status: DispatchStatus.optional(),
  driverId: Uuid.optional(),
});
export type DispatchListQuery = z.input<typeof DispatchListQuery>;
export const DispatchPage = pageOf(DispatchSummary);
export type DispatchPage = z.infer<typeof DispatchPage>;

export const DeliveryRequest = z.object({
  orderId: Uuid,
  lines: z
    .array(z.object({ dispatchLineId: Uuid, quantity: Quantity }))
    .min(1, 'Registra al menos una línea entregada'),
  partialReason: z.string().trim().max(300).optional(),
  paymentMethod: PaymentMethod.optional(),
  collectedAmount: Money.optional(),
});
export type DeliveryRequest = z.input<typeof DeliveryRequest>;

export const ReturnRequest = z.object({
  deliveryId: Uuid.optional(),
  dispatchLineId: Uuid,
  quantity: Quantity,
  reason: z.string().trim().min(3, 'Escribe el motivo').max(300),
});
export type ReturnRequest = z.input<typeof ReturnRequest>;

export const InspectReturnRequest = z.object({
  decision: z.enum(['reinstate', 'discard']),
});
export type InspectReturnRequest = z.input<typeof InspectReturnRequest>;

export const DriverView = z.object({
  id: Uuid,
  fullName: z.string(),
  email: z.string(),
});
export type DriverView = z.infer<typeof DriverView>;
