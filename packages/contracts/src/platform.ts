import { z } from 'zod';

export const HealthResponse = z.object({
  status: z.literal('ok'),
  version: z.string(),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ReadyResponse = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({ database: z.enum(['ok', 'error']) }),
});
export type ReadyResponse = z.infer<typeof ReadyResponse>;

/** Funcionalidades bloqueadas por decisiones pendientes (module-boundaries §5). */
export const FEATURE_FLAGS = {
  'feature.inventory.packageOpening': 'P-06',
  'feature.distribution.settlement': 'P-08',
  'feature.pos.kitchenVarianceAdjust': 'P-07',
  'feature.sales.discounts': 'P-09',
  'feature.pos.voids': 'P-09',
  'feature.accounting.posting': 'P-01..P-04',
  'feature.pos.fiscalDocument': 'P-02',
  'feature.assistant.writes': 'Q-B-01',
} as const;
export type FeatureFlag = keyof typeof FEATURE_FLAGS;
