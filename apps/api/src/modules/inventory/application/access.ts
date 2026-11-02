import type { ExecutionContext } from '../../../platform/http/context.js';
import { listFilter } from '../../admin/application/public.js';

/** Sedes permitidas para una consulta: null = todas (alcance ALL). */
export function siteIdsFor(ctx: ExecutionContext, permission: string): string[] | null {
  const filter = listFilter(ctx, permission);
  return filter.kind === 'all' ? null : filter.siteIds;
}
