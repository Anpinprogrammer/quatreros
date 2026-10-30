import { randomUUID } from 'node:crypto';
import type { Channel, RoleCode, Scope } from '@quatreros/contracts';
import type { RequestHandler } from 'express';

/**
 * Contexto de ejecución de cada petición (system-overview §2).
 * Los casos de uso reciben este contexto; nunca leen `req` directamente.
 */
export interface ExecutionContext {
  requestId: string;
  channel: Channel;
  /** Id de usuario de autenticación (Better Auth). Ausente en rutas públicas. */
  actorId?: string;
  /** Identidad de negocio resuelta por el módulo admin (roles, sedes, permisos). */
  actor?: Actor;
}

/** Usuario de negocio con sus permisos efectivos (especificación adm §4). */
export interface Actor {
  userId: string;
  authUserId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  roleCodes: RoleCode[];
  siteIds: string[];
  permissions: ReadonlyMap<string, Scope>;
  mfaRequired: boolean;
  mfaEnabled: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- única forma de ampliar Request de Express
  namespace Express {
    interface Request {
      ctx: ExecutionContext;
    }
  }
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Asigna requestId (respeta X-Request-Id si es seguro) y canal web por defecto. */
export const contextMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : `req_${randomUUID()}`;
  req.ctx = { requestId, channel: 'web' };
  res.setHeader('X-Request-Id', requestId);
  next();
};
