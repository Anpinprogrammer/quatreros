import type { AssistantStreamEvent } from '@quatreros/contracts';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import type { ToolGateway, ReadToolName, WriteToolName } from '../../tool-gateway/application/gateway.js';
import type { AssistantDb, AssistantProvider } from './ports.js';
import type { TicketRow } from '../infrastructure/repository.js';
import {
  closeTicket,
  finishToolCall,
  insertProposal,
  insertRequest,
  insertToolCall,
  touchTicket,
  updateTicketCost,
} from '../infrastructure/repository.js';
import type { TurnHub } from './hub.js';
import type { resolveSettings } from './settings.js';
import type { Env } from '../../../config/env.js';

const READ_TOOLS = new Set<ReadToolName>([
  'inventory_get_availability',
  'inventory_get_expiring_lots',
  'inventory_trace_lot',
  'catalog_search_products',
  'sales_list_open_orders',
  'sales_search_customers',
  'finance_get_customer_balance',
  'finance_get_overdue_receivables',
]);
const WRITE_TOOLS = new Set<WriteToolName>(['prepare_raw_material', 'prepare_recipe']);

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  listCostCents: number;
  activeSeconds: string;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseUsage(event: Record<string, unknown>): Usage {
  const raw =
    event.usage && typeof event.usage === 'object' ? (event.usage as Record<string, unknown>) : event;
  return {
    inputTokens: toNumber(raw.input_tokens ?? raw.inputTokens),
    outputTokens: toNumber(raw.output_tokens ?? raw.outputTokens),
    cacheReadTokens: toNumber(raw.cache_read_input_tokens ?? raw.cacheReadTokens),
    cacheWriteTokens: toNumber(raw.cache_creation_input_tokens ?? raw.cacheWriteTokens),
    listCostCents: Math.round(toNumber(raw.list_cost ?? raw.listCostCents)),
    activeSeconds:
      typeof raw.active_seconds === 'string' || typeof raw.active_seconds === 'number'
        ? String(raw.active_seconds)
        : typeof raw.activeSeconds === 'string' || typeof raw.activeSeconds === 'number'
          ? String(raw.activeSeconds)
          : '0',
  };
}

function messageText(event: Record<string, unknown>): string {
  const content = Array.isArray(event.content) ? event.content : [];
  return content
    .map((block) =>
      block && typeof block === 'object' && (block as { type?: string }).type === 'text'
        ? typeof (block as { text?: unknown }).text === 'string'
          ? (block as { text: string }).text
          : ''
        : '',
    )
    .join('');
}

export class TurnRunner {
  private readonly active = new Set<string>();

  constructor(
    private readonly db: AssistantDb,
    private readonly provider: AssistantProvider,
    private readonly gateway: ToolGateway,
    private readonly hub: TurnHub,
    private readonly env: Env,
  ) {}

  isActive(ticketId: string): boolean {
    return this.active.has(ticketId);
  }

  async start(
    ticket: TicketRow,
    text: string,
    ctx: ExecutionContext,
    settings: ReturnType<typeof resolveSettings>,
  ): Promise<void> {
    if (this.active.has(ticket.id)) {
      throw new AppError(409, 'TURN_IN_PROGRESS', 'Turno en curso', 'Espera a que termine la respuesta.');
    }
    this.active.add(ticket.id);
    try {
      await this.run(ticket, text, ctx, settings);
    } finally {
      this.active.delete(ticket.id);
    }
  }

  private publish(ticketId: string, event: AssistantStreamEvent): void {
    this.hub.publish(ticketId, event);
  }

  private async run(
    ticket: TicketRow,
    text: string,
    ctx: ExecutionContext,
    settings: ReturnType<typeof resolveSettings>,
  ): Promise<void> {
    const toolCtx: ExecutionContext = { ...ctx, channel: 'assistant' };
    const tools = new Set<string>();
    let proposalCreated = false;
    let usage: Usage | null = null;
    let failed = false;
    let operation: string | null = null;
    const startedAt = Date.now();

    if (!ticket.anthropicSessionId) {
      throw new AppError(503, 'ASSISTANT_UNAVAILABLE', 'Asistente no disponible');
    }

    try {
      await this.provider.sendUserMessage(ticket.anthropicSessionId, text);
      const stream = this.provider.stream(ticket.anthropicSessionId);
      for await (const raw of stream) {
        const event = raw as Record<string, unknown>;
        if (event.type === 'agent.message') {
          const delta = messageText(event);
          if (delta) this.publish(ticket.id, { type: 'message.delta', data: { text: delta } });
        }
        if (event.type === 'session.usage') {
          usage = parseUsage(event);
          this.publish(ticket.id, {
            type: 'usage.updated',
            data: {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              listCostCents: usage.listCostCents,
            },
          });
        }
        if (event.type === 'agent.custom_tool_use') {
          const name = typeof event.name === 'string' ? event.name : '';
          const toolUseId = typeof event.id === 'string' ? event.id : '';
          const input = event.input ?? {};
          tools.add(name);
          operation = operation ?? name;
          this.publish(ticket.id, { type: 'tool.started', data: { toolName: name, arguments: input } });
          const toolCallId = await insertToolCall(this.db, {
            ticketId: ticket.id,
            customToolUseId: toolUseId,
            toolName: name,
            arguments: input as Record<string, unknown>,
          });
          const toolStarted = Date.now();
          try {
            if (READ_TOOLS.has(name as ReadToolName)) {
              const result = await this.gateway.read(name as ReadToolName, input, toolCtx);
              await finishToolCall(this.db, toolCallId, {
                status: 'succeeded',
                result,
                durationMs: Date.now() - toolStarted,
              });
              await this.provider.sendToolResult(ticket.anthropicSessionId, toolUseId, result);
              this.publish(ticket.id, {
                type: 'tool.completed',
                data: { toolName: name, status: 'succeeded' },
              });
            } else if (WRITE_TOOLS.has(name as WriteToolName)) {
              const prepared = await this.gateway.prepare(name as WriteToolName, input, toolCtx);
              const proposal = await insertProposal(this.db, {
                ticketId: ticket.id,
                toolName: prepared.toolName,
                argumentsHash: prepared.argumentsHash,
                arguments: prepared.arguments,
                summary: prepared.summary,
                summaryText: prepared.summaryText,
                expiresAt: new Date(Date.now() + 10 * 60_000),
              });
              proposalCreated = true;
              await finishToolCall(this.db, toolCallId, {
                status: 'succeeded',
                result: { proposalId: proposal.id },
                durationMs: Date.now() - toolStarted,
              });
              await this.provider.sendToolResult(ticket.anthropicSessionId, toolUseId, {
                proposalId: proposal.id,
                status: 'pending_confirmation',
                message: 'La propuesta requiere confirmación humana en la interfaz.',
              });
              this.publish(ticket.id, {
                type: 'proposal.created',
                data: {
                  proposalId: proposal.id,
                  summary: proposal.summary,
                  expiresAt: proposal.expiresAt,
                },
              });
            } else {
              failed = true;
              await finishToolCall(this.db, toolCallId, {
                status: 'denied',
                result: { error: 'Herramienta no permitida' },
                errorCode: 'TOOL_NOT_ALLOWED',
                durationMs: Date.now() - toolStarted,
              });
              await this.provider.sendToolResult(
                ticket.anthropicSessionId,
                toolUseId,
                { error: 'Herramienta no disponible' },
                true,
              );
              this.publish(ticket.id, {
                type: 'error',
                data: { code: 'TOOL_NOT_ALLOWED', message: 'Herramienta no permitida.' },
              });
            }
          } catch (error) {
            failed = true;
            await finishToolCall(this.db, toolCallId, {
              status: 'failed',
              result: { error: error instanceof Error ? error.message : 'Error de herramienta' },
              errorCode: error instanceof AppError ? error.code : 'TOOL_FAILED',
              durationMs: Date.now() - toolStarted,
            });
            await this.provider.sendToolResult(
              ticket.anthropicSessionId,
              toolUseId,
              { error: error instanceof Error ? error.message : 'Error de herramienta' },
              true,
            );
            this.publish(ticket.id, {
              type: 'error',
              data: {
                code: error instanceof AppError ? error.code : 'TOOL_FAILED',
                message: error instanceof Error ? error.message : 'Error de herramienta',
              },
            });
          }
        }
        if (event.type === 'session.error') {
          failed = true;
          this.publish(ticket.id, {
            type: 'error',
            data: { code: 'ASSISTANT_ERROR', message: 'El asistente tuvo un error.' },
          });
        }
        if (event.type === 'session.status_idle') {
          const stop = event.stop_reason as { type?: string } | undefined;
          if (stop?.type !== 'requires_action') break;
        }
        if (event.type === 'session.status_terminated') {
          failed = true;
          break;
        }
        if (Date.now() - startedAt > settings.turnTimeoutSeconds * 1000) {
          failed = true;
          this.publish(ticket.id, {
            type: 'error',
            data: { code: 'TURN_TIMEOUT', message: 'La respuesta superó el tiempo límite.' },
          });
          break;
        }
      }
    } catch (error) {
      failed = true;
      this.publish(ticket.id, {
        type: 'error',
        data: {
          code: error instanceof AppError ? error.code : 'ASSISTANT_UNAVAILABLE',
          message:
            error instanceof AppError ? error.message : 'El asistente no está disponible en este momento.',
        },
      });
    }

    const toolList = [...tools];
    const summary = proposalCreated
      ? `Propuesta creada con ${toolList.join(', ')}; pendiente de confirmación humana.`
      : toolList.length > 0
        ? `Consulta completada con ${toolList.join(', ')}.`
        : 'Consulta completada.';

    const requestUsage = usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      listCostCents: 0,
      activeSeconds: ((Date.now() - startedAt) / 1000).toFixed(3),
    };
    await insertRequest(this.db, {
      ticketId: ticket.id,
      userId: ticket.userId,
      model: 'claude-haiku-5-5',
      inputTokens: requestUsage.inputTokens,
      outputTokens: requestUsage.outputTokens,
      cacheReadTokens: requestUsage.cacheReadTokens,
      cacheWriteTokens: requestUsage.cacheWriteTokens,
      listCostCents: requestUsage.listCostCents,
      activeSeconds: requestUsage.activeSeconds,
      toolNames: toolList,
      operation,
      result: failed ? 'failed' : 'completed',
    });
    await updateTicketCost(this.db, ticket.id);
    await closeTicket(this.db, ticket.id, {
      status: proposalCreated ? 'active' : 'closed',
      resolutionSummary: summary,
      toolsUsed: toolList,
      resultStatus: failed ? 'failed' : proposalCreated ? 'pending' : 'completed',
    });
    await touchTicket(this.db, ticket.id);
    this.publish(ticket.id, {
      type: 'message.completed',
      data: { requestId: toolCtx.requestId, summary },
    });
  }
}
