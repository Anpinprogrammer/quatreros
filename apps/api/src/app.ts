import { existsSync } from 'node:fs';
import path from 'node:path';
import { apiReference } from '@scalar/express-api-reference';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import type { Env } from './config/env.js';
import type { Auth } from './platform/auth/auth.js';
import { sessionMiddleware } from './platform/auth/session.js';
import { contextMiddleware } from './platform/http/context.js';
import { errorHandler, notFoundHandler } from './platform/http/errors.js';
import { healthRouter } from './platform/health/routes.js';
import type { IdempotencyStore } from './platform/idempotency/store.js';
import type { FeatureFlagReader } from './platform/features/flags.js';
import type { Logger } from './platform/logger.js';
import { buildOpenApiDocument } from './platform/openapi/document.js';

export interface AppDeps {
  env: Env;
  logger: Logger;
  pingDatabase: () => Promise<void>;
  idempotency: IdempotencyStore;
  flags: FeatureFlagReader;
  /** Ausente en pruebas que no necesitan autenticación. */
  auth?: Auth;
  /** Carpeta con la SPA compilada (apps/web/dist). En producción la API la sirve (deployment-design §1). */
  webDistDir?: string;
  /** Punto de extensión: cada módulo vertical monta aquí su router bajo /api/v1. */
  registerModules?: (api: express.Router, deps: AppDeps) => void;
}

export function createApp(deps: AppDeps): Express {
  const { env, logger } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás del proxy del hosting

  app.use(contextMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).ctx.requestId,
      customProps: (req) => ({ actorId: (req as express.Request).ctx.actorId }),
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Scalar (documentación) solo en entornos no productivos.
          scriptSrc: env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  // Salud: sin autenticación ni límite.
  app.use(healthRouter({ version: env.APP_VERSION, pingDatabase: deps.pingDatabase }));

  // Better Auth debe montarse ANTES de express.json() (lee el cuerpo él mismo).
  if (deps.auth) {
    app.all('/api/auth/{*any}', toNodeHandler(deps.auth));
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  if (deps.auth) app.use('/api', sessionMiddleware(deps.auth));

  // Documentación OpenAPI (api-design §8): solo fuera de producción.
  if (env.NODE_ENV !== 'production') {
    const doc = buildOpenApiDocument(env.APP_VERSION);
    app.get('/api/docs/openapi.json', (_req, res) => res.json(doc));
    app.use('/api/docs', apiReference({ url: '/api/docs/openapi.json' }));
  }

  const api = express.Router();
  deps.registerModules?.(api, deps);
  app.use('/api/v1', api);
  app.use('/api', notFoundHandler);

  // SPA compilada (un solo contenedor sirve API + web).
  if (deps.webDistDir && existsSync(deps.webDistDir)) {
    const dist = deps.webDistDir;
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('/{*any}', (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
