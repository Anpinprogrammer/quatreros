import type { HealthResponse, ReadyResponse } from '@quatreros/contracts';
import { Router } from 'express';

export interface HealthDeps {
  version: string;
  /** Verifica la base de datos (SELECT 1). */
  pingDatabase: () => Promise<void>;
}

/** /health (vida) y /ready (dependencias) — ADR-019, RNF-093. */
export function healthRouter(deps: HealthDeps): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', version: deps.version, time: new Date().toISOString() };
    res.json(body);
  });

  router.get('/ready', async (_req, res) => {
    let database: 'ok' | 'error' = 'ok';
    try {
      await deps.pingDatabase();
    } catch {
      database = 'error';
    }
    const body: ReadyResponse = { status: database === 'ok' ? 'ready' : 'not_ready', checks: { database } };
    res.status(database === 'ok' ? 200 : 503).json(body);
  });

  return router;
}
