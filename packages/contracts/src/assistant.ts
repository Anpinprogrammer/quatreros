import { z } from 'zod';
import { PageQuery, Uuid, pageOf } from './common.js';

/** Contratos del asistente de IA (entrega 8, DEC-106). */

export const TicketStatus = z.enum(['provisioning', 'active', 'closed', 'archived', 'terminated']);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const TicketResultStatus = z.enum(['pending', 'completed', 'failed', 'cancelled', 'budget_reached']);
export type TicketResultStatus = z.infer<typeof TicketResultStatus>;

export const ProposalStatus = z.enum([
  'draft',
  'pending_confirmation',
  'confirmed',
  'executed',
  'cancelled',
  'expired',
  'failed',
]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const AssistantToolName = z.enum([
  'inventory_get_availability',
  'inventory_get_expiring_lots',
  'inventory_trace_lot',
  'catalog_search_products',
  'sales_list_open_orders',
  'sales_search_customers',
  'finance_get_customer_balance',
  'finance_get_overdue_receivables',
  'prepare_raw_material',
  'prepare_recipe',
]);
export type AssistantToolName = z.infer<typeof AssistantToolName>;

export const TicketView = z.object({
  id: Uuid,
  channel: z.enum(['web', 'telegram']),
  status: TicketStatus,
  requestText: z.string(),
  resolutionSummary: z.string().nullable(),
  toolsUsed: z.array(z.string()),
  resultStatus: TicketResultStatus,
  costCents: z.number().int().min(0),
  startedAt: z.iso.datetime({ offset: true }),
  lastActivityAt: z.iso.datetime({ offset: true }),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type TicketView = z.infer<typeof TicketView>;

export const TicketListQuery = PageQuery.extend({});
export type TicketListQuery = z.input<typeof TicketListQuery>;
export const TicketPage = pageOf(TicketView);
export type TicketPage = z.infer<typeof TicketPage>;

export const CreateTicketRequest = z.object({
  channel: z.literal('web').default('web'),
  requestText: z
    .string()
    .trim()
    .min(1, 'Escribe lo que necesitas')
    .max(1000, 'La petición inicial admite máximo 1000 caracteres'),
});
export type CreateTicketRequest = z.input<typeof CreateTicketRequest>;

export const SendMessageRequest = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Escribe una pregunta')
    .max(2000, 'El mensaje admite máximo 2000 caracteres'),
});
export type SendMessageRequest = z.input<typeof SendMessageRequest>;

export const ProposalView = z.object({
  id: Uuid,
  ticketId: Uuid,
  toolName: z.enum(['prepare_raw_material', 'prepare_recipe']),
  summary: z.record(z.string(), z.unknown()),
  status: ProposalStatus,
  expiresAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});
export type ProposalView = z.infer<typeof ProposalView>;

export const ConfirmProposalResponse = z.object({
  status: z.literal('executed'),
  entityId: Uuid,
  summary: z.string(),
});
export type ConfirmProposalResponse = z.infer<typeof ConfirmProposalResponse>;

export const AssistantSettingsValues = z.object({
  sessionBudgetCents: z.number().int().min(0),
  dailyCapCents: z.number().int().min(0),
  weeklyCapCents: z.number().int().min(0),
  monthlyCapCents: z.number().int().min(0),
  alertPct: z.array(z.number().int().min(1).max(100)).default([80, 100]),
  maxToolCallsPerTurn: z.number().int().min(1).max(20),
  turnTimeoutSeconds: z.number().int().min(10).max(300),
  messagesPerTenMinutes: z.number().int().min(1).max(120),
});
export type AssistantSettingsValues = z.infer<typeof AssistantSettingsValues>;

export const AssistantSettings = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  settings: AssistantSettingsValues,
});
export type AssistantSettings = z.infer<typeof AssistantSettings>;

export const UpdateAssistantSettingsRequest = z.object({
  enabled: z.boolean().optional(),
  settings: AssistantSettingsValues.partial().optional(),
});
export type UpdateAssistantSettingsRequest = z.input<typeof UpdateAssistantSettingsRequest>;

export const AssistantStatus = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
});
export type AssistantStatus = z.infer<typeof AssistantStatus>;

export const AssistantUsageRow = z.object({
  id: z.number().int(),
  ticketId: Uuid,
  userName: z.string(),
  model: z.string(),
  operation: z.string().nullable(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  listCostCents: z.number().int(),
  activeSeconds: z.string(),
  result: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type AssistantUsageRow = z.infer<typeof AssistantUsageRow>;

export const AssistantUsageQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  userId: Uuid.optional(),
  model: z.string().trim().max(120).optional(),
  operation: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AssistantUsageQuery = z.input<typeof AssistantUsageQuery>;

export const AssistantUsage = z.object({
  totals: z.object({
    requests: z.number().int(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    listCostCents: z.number().int(),
    activeSeconds: z.string(),
  }),
  data: z.array(AssistantUsageRow),
});
export type AssistantUsage = z.infer<typeof AssistantUsage>;

export const AssistantStreamEvent = z.object({
  type: z.enum([
    'message.delta',
    'tool.started',
    'tool.completed',
    'proposal.created',
    'message.completed',
    'usage.updated',
    'error',
    'heartbeat',
  ]),
  data: z.record(z.string(), z.unknown()),
});
export type AssistantStreamEvent = z.infer<typeof AssistantStreamEvent>;
