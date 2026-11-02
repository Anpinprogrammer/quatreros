import { Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import {
  createDispatch,
  getDispatch,
  inspectReturn,
  listDispatches,
  listDrivers,
  loadDispatch,
  registerDelivery,
  registerReturn,
  type DistributionDeps,
} from '../application/distribution.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function distributionRouter(deps: DistributionDeps & { idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/distribution/drivers', async (req, res) => {
    res.json({ data: await listDrivers(deps, req.ctx) });
  });

  router.get('/distribution/dispatches', async (req, res) => {
    res.json(await listDispatches(deps, req.ctx, req.query));
  });

  router.post('/distribution/dispatches', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createDispatch(deps, req.ctx, req.body) });
  });

  router.get('/distribution/dispatches/:id', async (req, res) => {
    res.json({ data: await getDispatch(deps, req.ctx, id(req.params.id)) });
  });

  router.post('/distribution/dispatches/:id/load', async (req, res) => {
    res.json({ data: await loadDispatch(deps, req.ctx, id(req.params.id)) });
  });

  router.post(
    '/distribution/dispatches/:id/deliveries',
    requireIdempotency(deps.idempotency),
    async (req, res) => {
      res.status(201).json({ data: await registerDelivery(deps, req.ctx, id(req.params.id), req.body) });
    },
  );

  router.post(
    '/distribution/dispatches/:id/returns',
    requireIdempotency(deps.idempotency),
    async (req, res) => {
      res.status(201).json({ data: await registerReturn(deps, req.ctx, id(req.params.id), req.body) });
    },
  );

  router.post('/distribution/returns/:id/inspect', requireIdempotency(deps.idempotency), async (req, res) => {
    await inspectReturn(deps, req.ctx, id(req.params.id), req.body);
    res.status(204).send();
  });

  return router;
}
