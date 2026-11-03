import { Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import {
  closeShift,
  createDishRecipe,
  createDishRecipeVersion,
  createSale,
  getCurrentShift,
  getDishRecipeEndpoint,
  getSale,
  getShift,
  listDishRecipesEndpoint,
  listPosCatalog,
  listShifts,
  openShift,
  reviewShift,
  type PosDeps,
} from '../application/pos.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function posRouter(deps: PosDeps & { idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/pos/catalog', async (req, res) => {
    res.json({ data: await listPosCatalog(deps, req.ctx, req.query) });
  });

  router.get('/pos/shifts/current', async (req, res) => {
    res.json({ data: await getCurrentShift(deps, req.ctx, req.query) });
  });

  router.get('/pos/shifts', async (req, res) => {
    res.json(await listShifts(deps, req.ctx, req.query));
  });

  router.post('/pos/shifts', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await openShift(deps, req.ctx, req.body) });
  });

  router.get('/pos/shifts/:id', async (req, res) => {
    res.json({ data: await getShift(deps, req.ctx, id(req.params.id)) });
  });

  router.post('/pos/shifts/:id/close', requireIdempotency(deps.idempotency), async (req, res) => {
    res.json({ data: await closeShift(deps, req.ctx, id(req.params.id), req.body) });
  });

  router.post('/pos/shifts/:id/review', requireIdempotency(deps.idempotency), async (req, res) => {
    res.json({ data: await reviewShift(deps, req.ctx, id(req.params.id), req.body) });
  });

  router.post('/pos/sales', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createSale(deps, req.ctx, req.body) });
  });

  router.get('/pos/sales/:id', async (req, res) => {
    res.json({ data: await getSale(deps, req.ctx, id(req.params.id)) });
  });

  router.get('/pos/dish-recipes', async (req, res) => {
    res.json(await listDishRecipesEndpoint(deps, req.ctx, req.query));
  });

  router.get('/pos/dish-recipes/:id', async (req, res) => {
    res.json({ data: await getDishRecipeEndpoint(deps, req.ctx, id(req.params.id)) });
  });

  router.post('/pos/dish-recipes', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createDishRecipe(deps, req.ctx, req.body) });
  });

  router.post('/pos/dish-recipes/:id/versions', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createDishRecipeVersion(deps, req.ctx, id(req.params.id), req.body) });
  });

  return router;
}
