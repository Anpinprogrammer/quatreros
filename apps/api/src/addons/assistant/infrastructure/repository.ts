import { sql } from 'drizzle-orm';
import type { AssistantDb } from '../application/ports.js';

export interface TicketRow {
  id: string;
  userId: string;
  channel: 'web' | 'telegram';
  anthropicSessionId: string | null;
  agentId: string | null;
  agentVersion: string | null;
  status: 'provisioning' | 'active' | 'closed' | 'archived' | 'terminated';
  requestText: string;
  resolutionSummary: string | null;
  toolsUsed: string[];
  resultStatus: 'pending' | 'completed' | 'failed' | 'cancelled' | 'budget_reached';
  costCents: number;
  startedAt: Date | string;
  lastActivityAt: Date | string;
  closedAt: Date | string | null;
}

export interface ProposalRow {
  id: string;
  ticketId: string;
  toolName: 'prepare_raw_material' | 'prepare_recipe';
  argumentsHash: string;
  arguments: Record<string, unknown>;
  summary: Record<string, unknown>;
  status: 'draft' | 'pending_confirmation' | 'confirmed' | 'executed' | 'cancelled' | 'expired' | 'failed';
  expiresAt: Date | string;
  executedEntityType: string | null;
  executedEntityId: string | null;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
}

function row<T>(result: { rows: unknown[] }, _sample?: T): T | undefined {
  return result.rows[0] as T | undefined;
}

const TICKET_COLUMNS = sql`
  id, user_id as "userId", channel, anthropic_session_id as "anthropicSessionId",
  agent_id as "agentId", agent_version as "agentVersion", status,
  request_text as "requestText", resolution_summary as "resolutionSummary",
  tools_used as "toolsUsed", result_status as "resultStatus", cost_cents as "costCents",
  started_at as "startedAt", last_activity_at as "lastActivityAt", closed_at as "closedAt"
`;

export async function createTicketRow(
  db: AssistantDb,
  input: {
    id: string;
    userId: string;
    requestText: string;
    anthropicSessionId: string;
    agentId: string | null;
    agentVersion: string | null;
  },
): Promise<TicketRow> {
  const result = await db.execute(sql`
    insert into assistant.tickets
      (id, user_id, channel, request_text, anthropic_session_id, agent_id, agent_version, status)
    values
      (${input.id}, ${input.userId}, 'web', ${input.requestText}, ${input.anthropicSessionId},
       ${input.agentId}, ${input.agentVersion}, 'active')
    returning ${TICKET_COLUMNS}
  `);
  const created = row<TicketRow>(result);
  if (!created) throw new Error('No se pudo crear el ticket');
  return created;
}

export async function getTicketRow(db: AssistantDb, id: string): Promise<TicketRow | null> {
  const result = await db.execute(sql`
    select ${TICKET_COLUMNS} from assistant.tickets where id = ${id} limit 1
  `);
  return row<TicketRow>(result) ?? null;
}

export async function listTicketRows(db: AssistantDb, userId: string, limit: number): Promise<TicketRow[]> {
  const result = await db.execute(sql`
    select ${TICKET_COLUMNS} from assistant.tickets
    where user_id = ${userId}
    order by last_activity_at desc
    limit ${limit}
  `);
  return result.rows as unknown as TicketRow[];
}

export async function touchTicket(db: AssistantDb, id: string): Promise<void> {
  await db.execute(sql`
    update assistant.tickets set last_activity_at = now() where id = ${id}
  `);
}

export async function closeTicket(
  db: AssistantDb,
  id: string,
  input: {
    status: 'active' | 'closed' | 'archived' | 'terminated';
    resolutionSummary: string | null;
    toolsUsed: string[];
    resultStatus: 'pending' | 'completed' | 'failed' | 'cancelled' | 'budget_reached';
  },
): Promise<void> {
  await db.execute(sql`
    update assistant.tickets set
      status = ${input.status},
      resolution_summary = ${input.resolutionSummary},
      tools_used = coalesce(string_to_array(${input.toolsUsed.length ? input.toolsUsed.join(',') : null}, ','), '{}'::text[]),
      result_status = ${input.resultStatus},
      last_activity_at = now(),
      closed_at = case when ${input.status} = 'closed' then now() else closed_at end
    where id = ${id}
  `);
}

export async function updateTicketCost(db: AssistantDb, id: string): Promise<void> {
  await db.execute(sql`
    update assistant.tickets set
      cost_cents = coalesce((select sum(list_cost_cents) from assistant.requests where ticket_id = ${id}), 0),
      last_activity_at = now()
    where id = ${id}
  `);
}

export async function insertToolCall(
  db: AssistantDb,
  input: {
    ticketId: string;
    customToolUseId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  },
): Promise<string> {
  const result = await db.execute(sql`
    insert into assistant.tool_calls
      (ticket_id, custom_tool_use_id, tool_name, arguments, status)
    values (${input.ticketId}, ${input.customToolUseId}, ${input.toolName},
            ${JSON.stringify(input.arguments)}::jsonb, 'running')
    on conflict (custom_tool_use_id) do update set tool_name = excluded.tool_name
    returning id
  `);
  const created = row<{ id: string }>(result);
  if (!created) throw new Error('No se pudo registrar la llamada de herramienta');
  return created.id;
}

export async function finishToolCall(
  db: AssistantDb,
  id: string,
  input: {
    status: 'succeeded' | 'failed' | 'denied';
    result: unknown;
    errorCode?: string | undefined;
    durationMs: number;
  },
): Promise<void> {
  await db.execute(sql`
    update assistant.tool_calls set
      status = ${input.status},
      result = ${input.result === undefined ? null : JSON.stringify(input.result)}::jsonb,
      error_code = ${input.errorCode ?? null},
      duration_ms = ${input.durationMs}
    where id = ${id}
  `);
}

export async function insertProposal(
  db: AssistantDb,
  input: {
    ticketId: string;
    toolName: 'prepare_raw_material' | 'prepare_recipe';
    argumentsHash: string;
    arguments: Record<string, unknown>;
    summary: Record<string, unknown>;
    summaryText: string;
    expiresAt: Date;
  },
): Promise<ProposalRow> {
  const result = await db.execute(sql`
    insert into assistant.proposals
      (ticket_id, tool_name, arguments_hash, arguments, summary, status, expires_at)
    values (${input.ticketId}, ${input.toolName}, ${input.argumentsHash},
            ${JSON.stringify(input.arguments)}::jsonb,
            ${JSON.stringify({ ...input.summary, text: input.summaryText })}::jsonb,
            'pending_confirmation', ${input.expiresAt.toISOString()})
    returning id, ticket_id as "ticketId", tool_name as "toolName",
              arguments_hash as "argumentsHash", arguments, summary, status, expires_at as "expiresAt",
              executed_entity_type as "executedEntityType", executed_entity_id as "executedEntityId",
              created_at as "createdAt", confirmed_at as "confirmedAt"
  `);
  const created = row<ProposalRow>(result);
  if (!created) throw new Error('No se pudo crear la propuesta');
  return created;
}

export async function getProposalRow(db: AssistantDb, id: string): Promise<ProposalRow | null> {
  const result = await db.execute(sql`
    select id, ticket_id as "ticketId", tool_name as "toolName",
           arguments_hash as "argumentsHash", arguments, summary, status, expires_at as "expiresAt",
           executed_entity_type as "executedEntityType", executed_entity_id as "executedEntityId",
           created_at as "createdAt", confirmed_at as "confirmedAt"
    from assistant.proposals where id = ${id} limit 1
  `);
  return row<ProposalRow>(result) ?? null;
}

export async function updateProposal(
  db: AssistantDb,
  id: string,
  input: {
    status: ProposalRow['status'];
    executedEntityType?: string | null;
    executedEntityId?: string | null;
  },
): Promise<void> {
  await db.execute(sql`
    update assistant.proposals set
      status = ${input.status},
      executed_entity_type = ${input.executedEntityType ?? null},
      executed_entity_id = ${input.executedEntityId ?? null},
      confirmed_at = case when ${input.status} in ('confirmed','executed') then now() else confirmed_at end
    where id = ${id}
  `);
}

export async function insertRequest(
  db: AssistantDb,
  input: {
    ticketId: string;
    userId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    listCostCents: number;
    activeSeconds: string;
    toolNames: string[];
    operation: string | null;
    result: 'completed' | 'failed' | 'budget_reached' | 'interrupted';
  },
): Promise<void> {
  await db.execute(sql`
    insert into assistant.requests
      (ticket_id, user_id, model, input_tokens, output_tokens, cache_read_tokens,
       cache_write_tokens, list_cost_cents, active_seconds, tool_names, operation, result)
    values
      (${input.ticketId}, ${input.userId}, ${input.model}, ${input.inputTokens},
       ${input.outputTokens}, ${input.cacheReadTokens}, ${input.cacheWriteTokens},
       ${input.listCostCents}, ${input.activeSeconds},
       coalesce(string_to_array(${input.toolNames.length ? input.toolNames.join(',') : null}, ','), '{}'::text[]),
       ${input.operation}, ${input.result})
  `);
}

export async function spentBudgets(
  db: AssistantDb,
  ticketId: string,
  userId: string,
): Promise<{ sessionCents: number; dailyCents: number; weeklyCents: number; monthlyCents: number }> {
  const result = await db.execute(sql`
    select
      coalesce((select sum(list_cost_cents) from assistant.requests where ticket_id = ${ticketId}), 0)::int as "sessionCents",
      coalesce((select sum(list_cost_cents) from assistant.requests
        where user_id = ${userId} and created_at >= date_trunc('day', now())), 0)::int as "dailyCents",
      coalesce((select sum(list_cost_cents) from assistant.requests
        where user_id = ${userId} and created_at >= date_trunc('week', now())), 0)::int as "weeklyCents",
      coalesce((select sum(list_cost_cents) from assistant.requests
        where user_id = ${userId} and created_at >= date_trunc('month', now())), 0)::int as "monthlyCents"
  `);
  return (
    row<{
      sessionCents: number;
      dailyCents: number;
      weeklyCents: number;
      monthlyCents: number;
    }>(result) ?? { sessionCents: 0, dailyCents: 0, weeklyCents: 0, monthlyCents: 0 }
  );
}

export async function usageRows(
  db: AssistantDb,
  filters: {
    from?: string | undefined;
    to?: string | undefined;
    userId?: string | undefined;
    model?: string | undefined;
    operation?: string | undefined;
    limit: number;
  },
): Promise<{
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    listCostCents: number;
    activeSeconds: string;
  };
  rows: unknown[];
}> {
  const conditions = [
    filters.from ? sql`r.created_at >= ${filters.from}::date` : sql`true`,
    filters.to ? sql`r.created_at < (${filters.to}::date + interval '1 day')` : sql`true`,
    filters.userId ? sql`r.user_id = ${filters.userId}` : sql`true`,
    filters.model ? sql`r.model = ${filters.model}` : sql`true`,
    filters.operation ? sql`r.operation = ${filters.operation}` : sql`true`,
  ];
  const totalsResult = await db.execute(sql`
    select count(*)::int as requests, coalesce(sum(input_tokens), 0)::int as "inputTokens",
           coalesce(sum(output_tokens), 0)::int as "outputTokens",
           coalesce(sum(list_cost_cents), 0)::int as "listCostCents",
           coalesce(sum(active_seconds), 0)::text as "activeSeconds"
    from assistant.requests r where ${sql.join(conditions, sql` and `)}
  `);
  const rowsResult = await db.execute(sql`
    select r.id, r.ticket_id as "ticketId", u.full_name as "userName", r.model,
           r.operation, r.input_tokens as "inputTokens", r.output_tokens as "outputTokens",
           r.list_cost_cents as "listCostCents", r.active_seconds::text as "activeSeconds",
           r.result, r.created_at as "createdAt"
    from assistant.requests r
    join admin.users u on u.id = r.user_id
    where ${sql.join(conditions, sql` and `)}
    order by r.created_at desc
    limit ${filters.limit}
  `);
  return {
    totals: row<{
      requests: number;
      inputTokens: number;
      outputTokens: number;
      listCostCents: number;
      activeSeconds: string;
    }>(totalsResult) ?? {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      listCostCents: 0,
      activeSeconds: '0',
    },
    rows: rowsResult.rows,
  };
}

export async function getAddonSettings(
  db: AssistantDb,
): Promise<{ enabled: boolean; settings: Record<string, unknown> }> {
  const result = await db.execute(sql`
    select is_enabled as "enabled", settings from platform.addon_settings where addon = 'assistant'
  `);
  return (
    row<{ enabled: boolean; settings: Record<string, unknown> }>(result) ?? {
      enabled: false,
      settings: {},
    }
  );
}

export async function updateAddonSettings(
  db: AssistantDb,
  input: { enabled: boolean; settings: Record<string, unknown>; userId: string },
): Promise<void> {
  await db.execute(sql`
    update platform.addon_settings set
      is_enabled = ${input.enabled},
      settings = ${JSON.stringify(input.settings)}::jsonb,
      updated_by = ${input.userId},
      updated_at = now()
    where addon = 'assistant'
  `);
}

export async function countRecentMessages(db: AssistantDb, userId: string): Promise<number> {
  const result = await db.execute(sql`
    select count(*)::int as total from assistant.requests
    where user_id = ${userId} and created_at > now() - interval '10 minutes'
  `);
  return row<{ total: number }>(result)?.total ?? 0;
}

export async function recordAssistantAudit(
  db: AssistantDb,
  ctx: {
    actorId?: string | undefined;
    channel: string;
    requestId: string;
    actor?: { roleCodes: string[] } | undefined;
  },
  input: {
    action: string;
    entityType: string;
    entityId: string;
    after?: unknown;
    before?: unknown;
    proposalId?: string | null;
  },
): Promise<void> {
  await db.execute(sql`
    insert into audit.audit_log
      (actor_id, role_codes, channel, action, entity_type, entity_id, before_data, after_data, proposal_id, request_id)
    values
      (${ctx.actorId ?? null},
       coalesce(string_to_array(${ctx.actor?.roleCodes.length ? ctx.actor.roleCodes.join(',') : null}, ','), '{}'::text[]),
       ${ctx.channel}, ${input.action},
       ${input.entityType}, ${input.entityId},
       ${input.before === undefined ? null : JSON.stringify(input.before)}::jsonb,
       ${input.after === undefined ? null : JSON.stringify(input.after)}::jsonb,
       ${input.proposalId ?? null}, ${ctx.requestId})
  `);
}
