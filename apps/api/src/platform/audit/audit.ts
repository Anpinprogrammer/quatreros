import type { Database } from '../db/client.js';
import { auditLog } from '../db/schema/platform.js';
import type { ExecutionContext } from '../http/context.js';

/**
 * Registro de auditoría (ADR-012, BR-005). Se llama DENTRO de la transacción del caso de uso,
 * para que la auditoría exista si y solo si la operación se confirmó.
 */
export interface AuditEntry {
  action: string; // código de permiso, p. ej. 'cat.price.update'
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  siteId?: string;
  approvalId?: string;
  proposalId?: string;
  roleCodes?: string[];
}

type Executor = Pick<Database, 'insert'>;

export async function recordAudit(tx: Executor, ctx: ExecutionContext, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    actorId: ctx.actorId ?? null,
    channel: ctx.channel,
    requestId: ctx.requestId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeData: entry.before ?? null,
    afterData: entry.after ?? null,
    reason: entry.reason ?? null,
    siteId: entry.siteId ?? null,
    approvalId: entry.approvalId ?? null,
    proposalId: entry.proposalId ?? null,
    roleCodes: entry.roleCodes ?? [],
  });
}
