import { FEATURE_FLAGS } from '@quatreros/contracts';
import { sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { addonSettings, documentSequences, featureFlags } from './schema/platform.js';

/**
 * Datos semilla de plataforma (database-design §8). Idempotente: se puede ejecutar varias veces.
 * - Todas las funcionalidades bloqueadas quedan APAGADAS, con la decisión que las bloquea.
 * - Complementos IA y Telegram APAGADOS por defecto.
 * - Consecutivos de documentos.
 * Roles, permisos y políticas de aprobación se siembran con la funcionalidad de Administración,
 * cuando se apruebe la matriz de permisos (Q-B-01).
 */
export const DOCUMENT_TYPES = ['C', 'R', 'OP', 'T', 'AJ', 'P', 'D', 'DV', 'V', 'RC', 'CO'] as const;

export async function seedPlatform(db: Database): Promise<void> {
  await db
    .insert(featureFlags)
    .values(Object.entries(FEATURE_FLAGS).map(([key, blockedBy]) => ({ key, blockedBy, isEnabled: false })))
    .onConflictDoUpdate({ target: featureFlags.key, set: { blockedBy: sql`excluded.blocked_by` } });

  await db
    .insert(addonSettings)
    .values([{ addon: 'assistant' }, { addon: 'telegram' }])
    .onConflictDoNothing();

  await db
    .insert(documentSequences)
    .values(DOCUMENT_TYPES.map((docType) => ({ docType })))
    .onConflictDoNothing();
}
