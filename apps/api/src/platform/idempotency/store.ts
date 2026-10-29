import { and, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { idempotencyKeys } from '../db/schema/platform.js';

/**
 * Almacén de claves de idempotencia (ADR-010).
 * Interfaz separada para poder probar el middleware sin base de datos.
 */
export interface IdempotencyRecord {
  requestHash: string;
  status: 'in_progress' | 'completed';
  responseCode: number | null;
  responseBody: unknown;
}

export interface IdempotencyStore {
  /** Intenta reservar la clave. Devuelve null si se reservó; si ya existía, devuelve el registro previo. */
  reserve(
    actorId: string,
    key: string,
    route: string,
    requestHash: string,
  ): Promise<IdempotencyRecord | null>;
  complete(actorId: string, key: string, responseCode: number, responseBody: unknown): Promise<void>;
  /** Libera la clave (errores 5xx): el cliente puede reintentar con la misma clave. */
  release(actorId: string, key: string): Promise<void>;
  purgeExpired(): Promise<number>;
}

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: Database) {}

  async reserve(
    actorId: string,
    key: string,
    route: string,
    requestHash: string,
  ): Promise<IdempotencyRecord | null> {
    const inserted = await this.db
      .insert(idempotencyKeys)
      .values({ actorId, key, route, requestHash, status: 'in_progress' })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });
    if (inserted.length > 0) return null;
    const [existing] = await this.db
      .select({
        requestHash: idempotencyKeys.requestHash,
        status: idempotencyKeys.status,
        responseCode: idempotencyKeys.responseCode,
        responseBody: idempotencyKeys.responseBody,
      })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.actorId, actorId), eq(idempotencyKeys.key, key)));
    if (!existing) return this.reserve(actorId, key, route, requestHash); // expiró entre ambas consultas
    return existing;
  }

  async complete(actorId: string, key: string, responseCode: number, responseBody: unknown) {
    await this.db
      .update(idempotencyKeys)
      .set({ status: 'completed', responseCode, responseBody })
      .where(and(eq(idempotencyKeys.actorId, actorId), eq(idempotencyKeys.key, key)));
  }

  async release(actorId: string, key: string) {
    await this.db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.actorId, actorId), eq(idempotencyKeys.key, key)));
  }

  async purgeExpired() {
    const deleted = await this.db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.expiresAt, sql`now()`))
      .returning({ key: idempotencyKeys.key });
    return deleted.length;
  }
}

/** Implementación en memoria para pruebas unitarias. */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();
  private id(actorId: string, key: string) {
    return `${actorId}:${key}`;
  }
  reserve(actorId: string, key: string, _route: string, requestHash: string) {
    const existing = this.records.get(this.id(actorId, key));
    if (existing) return Promise.resolve(existing);
    this.records.set(this.id(actorId, key), {
      requestHash,
      status: 'in_progress',
      responseCode: null,
      responseBody: null,
    });
    return Promise.resolve(null);
  }
  complete(actorId: string, key: string, responseCode: number, responseBody: unknown) {
    const r = this.records.get(this.id(actorId, key));
    if (r) Object.assign(r, { status: 'completed', responseCode, responseBody });
    return Promise.resolve();
  }
  release(actorId: string, key: string) {
    this.records.delete(this.id(actorId, key));
    return Promise.resolve();
  }
  purgeExpired() {
    return Promise.resolve(0);
  }
}
