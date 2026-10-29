import { FEATURE_FLAGS, type FeatureFlag } from '@quatreros/contracts';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import type { Database } from '../db/client.js';
import { featureFlags } from '../db/schema/platform.js';
import { AppError } from '../http/errors.js';

/**
 * Funcionalidades bloqueadas por decisiones de negocio pendientes (module-boundaries §5).
 * Por defecto están APAGADAS; solo se encienden cuando se resuelve la decisión que las bloquea.
 */
export interface FeatureFlagReader {
  isEnabled(flag: FeatureFlag): Promise<boolean>;
}

export class PgFeatureFlags implements FeatureFlagReader {
  constructor(private readonly db: Database) {}
  async isEnabled(flag: FeatureFlag): Promise<boolean> {
    const [row] = await this.db
      .select({ isEnabled: featureFlags.isEnabled })
      .from(featureFlags)
      .where(eq(featureFlags.key, flag));
    return row?.isEnabled ?? false;
  }
}

/** Middleware: responde 423 FEATURE_BLOCKED si la funcionalidad no está habilitada. */
export function requireFeature(flags: FeatureFlagReader, flag: FeatureFlag): RequestHandler {
  return async (_req, _res, next) => {
    if (await flags.isEnabled(flag)) {
      next();
      return;
    }
    next(AppError.featureBlocked(FEATURE_FLAGS[flag]));
  };
}
