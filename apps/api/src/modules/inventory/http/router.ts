import { Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import {
  getInventorySummary,
  getLot,
  listAvailability,
  listLots,
  listMovements,
  listStockBalances,
  traceLot,
  type InventoryDeps,
} from '../application/inventory.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function inventoryRouter(deps: InventoryDeps): Router {
  const router = Router();

  router.get('/inventory/stock-balances', async (req, res) => {
    res.json(await listStockBalances(deps, req.ctx, req.query));
  });

  router.get('/inventory/availability', async (req, res) => {
    res.json(await listAvailability(deps, req.ctx, req.query));
  });

  router.get('/inventory/summary', async (req, res) => {
    res.json({ data: await getInventorySummary(deps, req.ctx) });
  });

  router.get('/inventory/lots', async (req, res) => {
    res.json(await listLots(deps, req.ctx, req.query));
  });

  router.get('/inventory/lots/:id', async (req, res) => {
    res.json({ data: await getLot(deps, req.ctx, id(req.params.id)) });
  });

  router.get('/inventory/lots/:id/traceability', async (req, res) => {
    res.json({ data: await traceLot(deps, req.ctx, id(req.params.id)) });
  });

  router.get('/inventory/movements', async (req, res) => {
    res.json(await listMovements(deps, req.ctx, req.query));
  });

  return router;
}
