import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import type { Database } from '../../../platform/db/client.js';
import { getEconomicEvent, listEconomicEvents } from '../application/events.js';

function id(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(value) || value <= 0) throw AppError.notFound();
  return value;
}

export function accountingRouter(deps: { db: Database }): Router {
  const router = Router();

  router.get('/accounting/economic-events', async (req, res) => {
    res.json(await listEconomicEvents(deps.db, req.ctx, req.query));
  });

  router.get('/accounting/economic-events/:id', async (req, res) => {
    res.json({ data: await getEconomicEvent(deps.db, req.ctx, id(req.params.id)) });
  });

  return router;
}
