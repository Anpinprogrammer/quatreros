import { z } from 'zod';
import { BusinessDate, Money, PageQuery, Uuid, pageOf } from './common.js';

/** Contratos de cartera, recaudos, conciliación y tablero financiero (entrega 7). */

export const ReceivableStatus = z.enum(['open', 'partially_paid', 'paid']);
export type ReceivableStatus = z.infer<typeof ReceivableStatus>;
export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  open: 'Abierta',
  partially_paid: 'Abono parcial',
  paid: 'Pagada',
};

export const AgingBucketKey = z.enum([
  'due',
  'overdue_1_30',
  'overdue_31_60',
  'overdue_61_90',
  'overdue_90_plus',
]);
export type AgingBucketKey = z.infer<typeof AgingBucketKey>;
export const AGING_BUCKET_LABELS: Record<AgingBucketKey, string> = {
  due: 'Por vencer',
  overdue_1_30: 'Vencida 1–30',
  overdue_31_60: 'Vencida 31–60',
  overdue_61_90: 'Vencida 61–90',
  overdue_90_plus: 'Vencida +90',
};

export const AgingBuckets = z.object({
  due: Money,
  overdue_1_30: Money,
  overdue_31_60: Money,
  overdue_61_90: Money,
  overdue_90_plus: Money,
});
export type AgingBuckets = z.infer<typeof AgingBuckets>;

export const ReceivableView = z.object({
  id: Uuid,
  customerId: Uuid,
  customerName: z.string(),
  siteId: Uuid.nullable(),
  siteName: z.string(),
  sourceType: z.string(),
  sourceId: Uuid,
  amount: Money,
  balance: Money,
  issuedOn: BusinessDate,
  dueOn: BusinessDate,
  status: ReceivableStatus,
  daysOverdue: z.number().int().min(0),
  bucket: AgingBucketKey,
});
export type ReceivableView = z.infer<typeof ReceivableView>;

export const ReceivableListQuery = PageQuery.extend({
  q: z.string().trim().max(120).optional(),
  status: ReceivableStatus.optional(),
  customerId: Uuid.optional(),
  siteId: Uuid.optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
  overdue: z.coerce.boolean().optional(),
});
export type ReceivableListQuery = z.input<typeof ReceivableListQuery>;
export const ReceivablePage = pageOf(ReceivableView);
export type ReceivablePage = z.infer<typeof ReceivablePage>;

export const CustomerBalance = z.object({
  customerId: Uuid,
  customerName: z.string(),
  total: Money,
  receivables: z.array(ReceivableView),
});
export type CustomerBalance = z.infer<typeof CustomerBalance>;

export const AgingCustomerView = z.object({
  customerId: Uuid,
  customerName: z.string(),
  total: Money,
  overdue: Money,
  dueSoon: Money,
  buckets: AgingBuckets,
});
export type AgingCustomerView = z.infer<typeof AgingCustomerView>;

export const AgingResponse = z.object({
  asOf: BusinessDate,
  totals: z.object({
    open: Money,
    overdue: Money,
    dueSoon: Money,
    buckets: AgingBuckets,
  }),
  customers: z.array(AgingCustomerView),
});
export type AgingResponse = z.infer<typeof AgingResponse>;

export const AgingQuery = z.object({
  customerId: Uuid.optional(),
  siteId: Uuid.optional(),
  asOf: BusinessDate.optional(),
});
export type AgingQuery = z.input<typeof AgingQuery>;

export const CollectionKind = z.enum(['delivery', 'payment']);
export type CollectionKind = z.infer<typeof CollectionKind>;
export const CollectionStatus = z.enum(['registered', 'reconciled', 'reconciled_with_variance']);
export type CollectionStatus = z.infer<typeof CollectionStatus>;
export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  registered: 'Pendiente de conciliar',
  reconciled: 'Conciliado',
  reconciled_with_variance: 'Conciliado con diferencia',
};
export const CollectorType = z.enum(['driver', 'cash_register', 'office']);
export type CollectorType = z.infer<typeof CollectorType>;
export const COLLECTOR_TYPE_LABELS: Record<CollectorType, string> = {
  driver: 'Distribuidor',
  cash_register: 'Caja',
  office: 'Oficina',
};

export const CollectionView = z.object({
  id: Uuid,
  number: z.string(),
  kind: CollectionKind,
  siteId: Uuid,
  siteName: z.string(),
  collectorType: CollectorType,
  collectorUserId: Uuid.nullable(),
  collectorName: z.string().nullable(),
  customerId: Uuid.nullable(),
  customerName: z.string().nullable(),
  paymentMethodId: Uuid,
  paymentMethodName: z.string(),
  amount: Money,
  allocatedAmount: Money,
  status: CollectionStatus,
  deliveryId: Uuid.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type CollectionView = z.infer<typeof CollectionView>;

export const CollectionAllocationView = z.object({
  receivableId: Uuid,
  customerName: z.string(),
  sourceType: z.string(),
  sourceId: Uuid,
  dueOn: BusinessDate,
  amount: Money,
});
export type CollectionAllocationView = z.infer<typeof CollectionAllocationView>;

export const CollectionDetail = CollectionView.extend({
  allocations: z.array(CollectionAllocationView),
});
export type CollectionDetail = z.infer<typeof CollectionDetail>;

export const CollectionListQuery = PageQuery.extend({
  q: z.string().trim().max(120).optional(),
  siteId: Uuid.optional(),
  collectorType: CollectorType.optional(),
  collectorUserId: Uuid.optional(),
  customerId: Uuid.optional(),
  status: CollectionStatus.optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
});
export type CollectionListQuery = z.input<typeof CollectionListQuery>;
export const CollectionPage = pageOf(CollectionView);
export type CollectionPage = z.infer<typeof CollectionPage>;

export const CreatePaymentRequest = z.object({
  customerId: Uuid,
  siteId: Uuid,
  paymentMethodId: Uuid,
  amount: Money,
  allocations: z.array(z.object({ receivableId: Uuid, amount: Money })).optional(),
  note: z.string().trim().max(300).optional(),
});
export type CreatePaymentRequest = z.input<typeof CreatePaymentRequest>;
export type PaymentReceipt = CollectionDetail;

export const FinancePaymentMethodView = z.object({
  id: Uuid,
  name: z.string(),
  isCash: z.boolean(),
});
export type FinancePaymentMethodView = z.infer<typeof FinancePaymentMethodView>;

export const ReconciliationLineView = z.object({
  paymentMethodId: Uuid,
  paymentMethodName: z.string(),
  expectedAmount: Money,
  receivedAmount: Money,
  variance: z.string(),
});
export type ReconciliationLineView = z.infer<typeof ReconciliationLineView>;

export const ReconciliationView = z.object({
  id: Uuid,
  number: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  collectorType: CollectorType,
  collectorUserId: Uuid.nullable(),
  collectorName: z.string().nullable(),
  periodFrom: BusinessDate,
  periodTo: BusinessDate,
  expectedAmount: Money,
  receivedAmount: Money,
  variance: z.string(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  lines: z.array(ReconciliationLineView),
  collectionIds: z.array(Uuid),
});
export type ReconciliationView = z.infer<typeof ReconciliationView>;

export const ReconciliationListQuery = PageQuery.extend({
  siteId: Uuid.optional(),
  collectorType: CollectorType.optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
});
export type ReconciliationListQuery = z.input<typeof ReconciliationListQuery>;
export const ReconciliationPage = pageOf(ReconciliationView);
export type ReconciliationPage = z.infer<typeof ReconciliationPage>;

export const CreateReconciliationRequest = z.object({
  siteId: Uuid,
  collectorType: CollectorType,
  collectorUserId: Uuid.optional(),
  collectionIds: z.array(Uuid).min(1, 'Selecciona al menos un recaudo'),
  counts: z
    .array(z.object({ paymentMethodId: Uuid, receivedAmount: Money }))
    .min(1, 'Registra el conteo por método'),
  note: z.string().trim().max(300).optional(),
});
export type CreateReconciliationRequest = z.input<typeof CreateReconciliationRequest>;

export const FinanceDashboard = z.object({
  receivables: z.object({
    open: Money,
    overdue: Money,
    dueSoon: Money,
    buckets: AgingBuckets,
  }),
  collections: z.object({ pendingCount: z.number().int(), pendingAmount: Money }),
  reconciliations: z.object({ pendingCount: z.number().int(), lastVariance: z.string().nullable() }),
});
export type FinanceDashboard = z.infer<typeof FinanceDashboard>;
