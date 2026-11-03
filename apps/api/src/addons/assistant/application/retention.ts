import type { AssistantDb, AssistantProvider } from './ports.js';
import {
  archiveCandidates,
  deleteCandidates,
  markTicketArchived,
  markTicketDeleted,
} from '../infrastructure/repository.js';

/** Q-IA-05 / DEC-108: archivar a las 24 h y borrar en Anthropic a los 30 días. */
export const RETENTION_ARCHIVE_HOURS = 24;
export const RETENTION_DELETE_DAYS = 30;

export interface RetentionResult {
  archived: number;
  deleted: number;
  errors: { ticketId: string; action: 'archive' | 'delete'; message: string }[];
}

/**
 * Retención de sesiones en Anthropic. No borra tickets ni métricas locales:
 * conserva la petición, el resumen, las herramientas y el consumo.
 */
export class AssistantRetentionService {
  constructor(
    private readonly db: AssistantDb,
    private readonly provider: AssistantProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(): Promise<RetentionResult> {
    const now = this.now();
    const archiveBefore = new Date(now.getTime() - RETENTION_ARCHIVE_HOURS * 60 * 60 * 1000);
    const deleteBefore = new Date(now.getTime() - RETENTION_DELETE_DAYS * 24 * 60 * 60 * 1000);
    const result: RetentionResult = { archived: 0, deleted: 0, errors: [] };

    for (const ticket of await archiveCandidates(this.db, archiveBefore)) {
      if (!ticket.anthropicSessionId) continue;
      try {
        await this.provider.archiveSession(ticket.anthropicSessionId);
        await markTicketArchived(this.db, ticket.id);
        result.archived += 1;
      } catch (error) {
        result.errors.push({
          ticketId: ticket.id,
          action: 'archive',
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    for (const ticket of await deleteCandidates(this.db, deleteBefore)) {
      if (!ticket.anthropicSessionId) continue;
      try {
        await this.provider.deleteSession(ticket.anthropicSessionId);
        await markTicketDeleted(this.db, ticket.id);
        result.deleted += 1;
      } catch (error) {
        result.errors.push({
          ticketId: ticket.id,
          action: 'delete',
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return result;
  }
}
