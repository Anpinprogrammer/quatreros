import { z } from 'zod';
import { BusinessDate, Money, PageQuery, Uuid, pageOf } from './common.js';

/** Contratos de hechos económicos (RF-303, entrega 7). */

export const EconomicEventType = z.enum([
  'PurchaseReceived',
  'ProductionCompleted',
  'SaleCompleted',
  'ShiftClosed',
  'ReceivableCreated',
  'PaymentReceived',
  'CollectionReconciled',
]);
export type EconomicEventType = z.infer<typeof EconomicEventType>;

export const EconomicEventStatus = z.enum(['pending', 'posted', 'void']);
export type EconomicEventStatus = z.infer<typeof EconomicEventStatus>;
export const ECONOMIC_EVENT_STATUS_LABELS: Record<EconomicEventStatus, string> = {
  pending: 'Pendiente de contabilizar',
  posted: 'Contabilizado',
  void: 'Anulado',
};

export const EconomicEventView = z.object({
  id: z.number().int(),
  type: EconomicEventType,
  sourceType: z.string(),
  sourceId: Uuid,
  siteId: Uuid.nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
  amount: Money.nullable(),
  payload: z.record(z.string(), z.unknown()),
  status: EconomicEventStatus,
  createdAt: z.iso.datetime({ offset: true }),
});
export type EconomicEventView = z.infer<typeof EconomicEventView>;

export const EconomicEventListQuery = PageQuery.extend({
  type: EconomicEventType.optional(),
  status: EconomicEventStatus.optional(),
  sourceType: z.string().trim().max(80).optional(),
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
});
export type EconomicEventListQuery = z.input<typeof EconomicEventListQuery>;
export const EconomicEventPage = pageOf(EconomicEventView);
export type EconomicEventPage = z.infer<typeof EconomicEventPage>;
