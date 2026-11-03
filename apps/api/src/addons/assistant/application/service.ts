import { randomUUID } from 'node:crypto';
import {
  AssistantUsageQuery,
  CreateTicketRequest,
  SendMessageRequest,
  TicketListQuery,
  UpdateAssistantSettingsRequest,
  type AssistantSettings,
  type AssistantStatus,
  type AssistantUsage,
  type ConfirmProposalResponse,
  type TicketPage,
  type TicketView,
} from '@quatreros/contracts';
import type { Env } from '../../../config/env.js';
import type { FeatureFlagReader } from '../../../platform/features/flags.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize } from '../../../modules/admin/application/public.js';
import type { ToolGateway } from '../../tool-gateway/application/gateway.js';
import { hashToolArguments } from '../../tool-gateway/application/gateway.js';
import { budgetExceeded, canConfirmProposal } from '../domain/assistant.js';
import type { AssistantDb, AssistantProvider } from './ports.js';
import type { TurnHub } from './hub.js';
import type { TicketRow } from '../infrastructure/repository.js';
import {
  closeTicket,
  countRecentMessages,
  createTicketRow,
  getAddonSettings,
  getProposalRow,
  getTicketRow,
  listTicketRows,
  recordAssistantAudit,
  spentBudgets,
  updateAddonSettings,
  updateProposal,
  updateTicketCost,
  usageRows,
} from '../infrastructure/repository.js';
import { resolveSettings } from './settings.js';

function toTicket(row: TicketRow): TicketView {
  return {
    ...row,
    startedAt: new Date(row.startedAt).toISOString(),
    lastActivityAt: new Date(row.lastActivityAt).toISOString(),
    closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
  };
}

function auditCtx(ctx: ExecutionContext) {
  return {
    actorId: ctx.actorId,
    channel: ctx.channel,
    requestId: ctx.requestId,
    actor: ctx.actor,
  };
}

export class AssistantService {
  constructor(
    private readonly db: AssistantDb,
    private readonly provider: AssistantProvider,
    private readonly gateway: ToolGateway,
    private readonly hub: TurnHub,
    private readonly runner: {
      isActive(ticketId: string): boolean;
      start(
        ticket: TicketRow,
        text: string,
        ctx: ExecutionContext,
        settings: ReturnType<typeof resolveSettings>,
      ): Promise<void>;
    },
    private readonly env: Env,
    private readonly flags: FeatureFlagReader,
  ) {}

  private async enabled(): Promise<{ enabled: boolean; settings: Record<string, unknown> }> {
    const addon = await getAddonSettings(this.db);
    if (!addon.enabled) throw AppError.notFound();
    return addon;
  }

  private async effectiveSettings(): Promise<ReturnType<typeof resolveSettings>> {
    const addon = await getAddonSettings(this.db);
    return resolveSettings(this.env, addon.settings);
  }

  async status(ctx: ExecutionContext): Promise<AssistantStatus> {
    authorize(ctx, 'ia.query');
    const addon = await getAddonSettings(this.db);
    return { enabled: addon.enabled, configured: this.provider.configured };
  }

  async settings(ctx: ExecutionContext): Promise<AssistantSettings> {
    authorize(ctx, 'adm.addon.toggle');
    const addon = await getAddonSettings(this.db);
    return {
      enabled: addon.enabled,
      configured: this.provider.configured,
      settings: resolveSettings(this.env, addon.settings),
    };
  }

  async updateSettings(ctx: ExecutionContext, raw: unknown): Promise<AssistantSettings> {
    const actor = authorize(ctx, 'adm.addon.toggle');
    const input = UpdateAssistantSettingsRequest.parse(raw);
    const current = await getAddonSettings(this.db);
    const nextSettings = resolveSettings(this.env, {
      ...current.settings,
      ...(input.settings ?? {}),
    });
    const nextEnabled = input.enabled ?? current.enabled;
    if (nextEnabled && !this.provider.configured) {
      throw new AppError(
        409,
        'ASSISTANT_NOT_CONFIGURED',
        'Asistente sin configurar',
        'Faltan las credenciales o los identificadores del agente.',
      );
    }
    await updateAddonSettings(this.db, {
      enabled: nextEnabled,
      settings: nextSettings,
      userId: actor.userId,
    });
    await recordAssistantAudit(this.db, auditCtx(ctx), {
      action: 'ia.settings.update',
      entityType: 'assistant.settings',
      entityId: 'assistant',
      before: { enabled: current.enabled, settings: current.settings },
      after: { enabled: nextEnabled, settings: nextSettings },
    });
    return {
      enabled: nextEnabled,
      configured: this.provider.configured,
      settings: nextSettings,
    };
  }

  async listTickets(ctx: ExecutionContext, raw: unknown): Promise<TicketPage> {
    const actor = authorize(ctx, 'ia.query');
    await this.enabled();
    const query = TicketListQuery.parse(raw);
    const rows = await listTicketRows(this.db, actor.userId, query.limit);
    return {
      data: rows.map(toTicket),
      page: { nextCursor: null, limit: query.limit },
    };
  }

  async createTicket(ctx: ExecutionContext, raw: unknown): Promise<TicketView> {
    const actor = authorize(ctx, 'ia.query');
    await this.enabled();
    if (!this.provider.configured) {
      throw new AppError(
        409,
        'ASSISTANT_NOT_CONFIGURED',
        'Asistente sin configurar',
        'Faltan las credenciales o los identificadores del agente.',
      );
    }
    const input = CreateTicketRequest.parse(raw);
    const ticketId = randomUUID();
    const session = await this.provider.createSession({
      ticketId,
      userId: actor.userId,
      agentVersion: this.env.ANTHROPIC_AGENT_VERSION,
    });
    try {
      const ticket = await createTicketRow(this.db, {
        id: ticketId,
        userId: actor.userId,
        requestText: input.requestText,
        anthropicSessionId: session.sessionId,
        agentId: this.env.ANTHROPIC_AGENT_ID ?? null,
        agentVersion: this.env.ANTHROPIC_AGENT_VERSION ?? null,
      });
      await recordAssistantAudit(this.db, auditCtx(ctx), {
        action: 'ia.ticket.create',
        entityType: 'assistant.ticket',
        entityId: ticket.id,
        after: { requestText: ticket.requestText, channel: ticket.channel },
      });
      return toTicket(ticket);
    } catch (error) {
      await this.provider.archiveSession(session.sessionId);
      throw error;
    }
  }

  private async ownedTicket(ctx: ExecutionContext, id: string): Promise<TicketRow> {
    const actor = authorize(ctx, 'ia.query');
    const ticket = await getTicketRow(this.db, id);
    if (!ticket || ticket.userId !== actor.userId) throw AppError.notFound();
    return ticket;
  }

  async sendMessage(ctx: ExecutionContext, id: string, raw: unknown): Promise<{ turnId: string }> {
    const ticket = await this.ownedTicket(ctx, id);
    await this.enabled();
    if (!this.provider.configured) {
      throw new AppError(409, 'ASSISTANT_NOT_CONFIGURED', 'Asistente sin configurar');
    }
    if (this.runner.isActive(ticket.id)) {
      throw new AppError(409, 'TURN_IN_PROGRESS', 'Turno en curso', 'Espera la respuesta anterior.');
    }
    const input = SendMessageRequest.parse(raw);
    const settings = await this.effectiveSettings();
    const recent = await countRecentMessages(this.db, ticket.userId);
    if (recent >= settings.messagesPerTenMinutes) {
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Demasiados mensajes',
        'Espera unos minutos antes de volver a preguntar.',
      );
    }
    const spent = await spentBudgets(this.db, ticket.id, ticket.userId);
    const exceeded = budgetExceeded(spent, {
      sessionCents: settings.sessionBudgetCents,
      dailyCents: settings.dailyCapCents,
      weeklyCents: settings.weeklyCapCents,
      monthlyCents: settings.monthlyCapCents,
    });
    if (exceeded) {
      await closeTicket(this.db, ticket.id, {
        status: 'active',
        resolutionSummary: `Asistente en pausa por el techo ${exceeded}.`,
        toolsUsed: ticket.toolsUsed,
        resultStatus: 'budget_reached',
      });
      throw new AppError(
        409,
        'BUDGET_REACHED',
        'Presupuesto agotado',
        `Se alcanzó el techo ${exceeded} del asistente.`,
      );
    }
    const turnId = randomUUID();
    void this.runner.start(ticket, input.text, ctx, settings).catch(() => undefined);
    return { turnId };
  }

  async confirmProposal(ctx: ExecutionContext, id: string): Promise<ConfirmProposalResponse> {
    const proposal = await getProposalRow(this.db, id);
    if (!proposal) throw AppError.notFound();
    const ticket = await this.ownedTicket(ctx, proposal.ticketId);
    await this.enabled();
    if (!(await this.flags.isEnabled('feature.assistant.writes'))) {
      throw AppError.featureBlocked('P-10');
    }
    if (proposal.status === 'executed' && proposal.executedEntityId) {
      return {
        status: 'executed',
        entityId: proposal.executedEntityId,
        summary: 'La propuesta ya fue ejecutada.',
      };
    }
    const check = canConfirmProposal({
      status: proposal.status,
      expiresAt: new Date(proposal.expiresAt),
      now: new Date(),
      argumentsHash: proposal.argumentsHash,
      expectedHash: hashToolArguments(proposal.arguments),
    });
    if (!check.ok) {
      if (check.reason === 'expired') {
        await updateProposal(this.db, proposal.id, { status: 'expired' });
        throw new AppError(
          409,
          'PROPOSAL_EXPIRED',
          'Propuesta vencida',
          'Vuelve a pedir la operación para generar una nueva propuesta.',
        );
      }
      if (check.reason === 'stale') {
        throw new AppError(
          409,
          'PROPOSAL_STALE',
          'Propuesta desactualizada',
          'Los datos cambiaron; genera una propuesta nueva.',
        );
      }
      throw new AppError(
        409,
        'PROPOSAL_ALREADY_HANDLED',
        'Propuesta ya procesada',
        'La propuesta fue cancelada o ejecutada.',
      );
    }
    const result = await this.gateway.execute(proposal.toolName, proposal.arguments, ctx);
    await updateProposal(this.db, proposal.id, {
      status: 'executed',
      executedEntityType: result.entityType,
      executedEntityId: result.entityId,
    });
    await closeTicket(this.db, ticket.id, {
      status: 'closed',
      resolutionSummary: `${result.summary} Ejecutado con ${proposal.toolName}.`,
      toolsUsed: [...new Set([...ticket.toolsUsed, proposal.toolName])],
      resultStatus: 'completed',
    });
    await updateTicketCost(this.db, ticket.id);
    await recordAssistantAudit(this.db, auditCtx(ctx), {
      action: 'ia.proposal.confirm',
      entityType: 'assistant.proposal',
      entityId: proposal.id,
      proposalId: proposal.id,
      after: { toolName: proposal.toolName, entityId: result.entityId },
    });
    return { status: 'executed', entityId: result.entityId, summary: result.summary };
  }

  async cancelProposal(ctx: ExecutionContext, id: string): Promise<{ status: 'cancelled' }> {
    const proposal = await getProposalRow(this.db, id);
    if (!proposal) throw AppError.notFound();
    await this.ownedTicket(ctx, proposal.ticketId);
    await this.enabled();
    if (proposal.status === 'pending_confirmation') {
      await updateProposal(this.db, proposal.id, { status: 'cancelled' });
      await recordAssistantAudit(this.db, auditCtx(ctx), {
        action: 'ia.proposal.cancel',
        entityType: 'assistant.proposal',
        entityId: proposal.id,
        proposalId: proposal.id,
        after: { toolName: proposal.toolName },
      });
    }
    return { status: 'cancelled' };
  }

  async usage(ctx: ExecutionContext, raw: unknown): Promise<AssistantUsage> {
    authorize(ctx, 'ia.usage.read');
    const query = AssistantUsageQuery.parse(raw);
    const result = await usageRows(this.db, query);
    return {
      totals: result.totals,
      data: result.rows as unknown as AssistantUsage['data'],
    };
  }

  async stream(
    ctx: ExecutionContext,
    id: string,
  ): Promise<{ ticket: TicketRow; replay: ReturnType<TurnHub['replay']>; unsubscribe: () => void }> {
    const ticket = await this.ownedTicket(ctx, id);
    await this.enabled();
    return {
      ticket,
      replay: this.hub.replay(ticket.id),
      unsubscribe: () => undefined,
    };
  }
}
