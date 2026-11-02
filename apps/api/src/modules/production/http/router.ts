import { Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import {
  closeOrder,
  consumeOrder,
  createOrder,
  getOrder,
  listOrders,
  previewOrder,
  type ProductionDeps,
} from '../application/production.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function productionRouter(deps: ProductionDeps & { idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/production/orders', async (req, res) => {
    res.json(await listOrders(deps, req.ctx, req.query));
  });

  router.post('/production/orders', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createOrder(deps, req.ctx, req.body) });
  });

  router.get('/production/availability', async (req, res) => {
    res.json({ data: await previewOrder(deps, req.ctx, req.query) });
  });

  router.get('/production/orders/:id', async (req, res) => {
    res.json({ data: await getOrder(deps, req.ctx, id(req.params.id)) });
  });

  router.post('/production/orders/:id/consume', requireIdempotency(deps.idempotency), async (req, res) => {
    res.json({ data: await consumeOrder(deps, req.ctx, id(req.params.id), req.body) });
  });

  router.post('/production/orders/:id/close', requireIdempotency(deps.idempotency), async (req, res) => {
    res.json({ data: await closeOrder(deps, req.ctx, id(req.params.id), req.body) });
  });

  return router;
}
