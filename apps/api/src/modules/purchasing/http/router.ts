import { Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import { expectedVersion } from '../../../platform/http/version.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import {
  createPurchase,
  createSupplier,
  getPurchase,
  listPurchases,
  listSuppliers,
  receivePurchase,
  updateSupplier,
  type PurchasingDeps,
} from '../application/purchasing.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function purchasingRouter(deps: PurchasingDeps & { idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/purchasing/suppliers', async (req, res) => {
    res.json(await listSuppliers(deps, req.ctx, req.query));
  });

  router.post('/purchasing/suppliers', requireIdempotency(deps.idempotency), async (req, res) => {
    const supplier = await createSupplier(deps, req.ctx, req.body);
    res.setHeader('ETag', `"v${String(supplier.version)}"`);
    res.status(201).json({ data: supplier });
  });

  router.patch('/purchasing/suppliers/:id', async (req, res) => {
    const supplier = await updateSupplier(
      deps,
      req.ctx,
      id(req.params.id),
      expectedVersion(req.header('if-match')),
      req.body,
    );
    res.setHeader('ETag', `"v${String(supplier.version)}"`);
    res.json({ data: supplier });
  });

  router.get('/purchasing/purchases', async (req, res) => {
    res.json(await listPurchases(deps, req.ctx, req.query));
  });

  router.post('/purchasing/purchases', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createPurchase(deps, req.ctx, req.body) });
  });

  router.get('/purchasing/purchases/:id', async (req, res) => {
    res.json({ data: await getPurchase(deps, req.ctx, id(req.params.id)) });
  });

  router.post(
    '/purchasing/purchases/:id/receipts',
    requireIdempotency(deps.idempotency),
    async (req, res) => {
      res.status(201).json({ data: await receivePurchase(deps, req.ctx, id(req.params.id), req.body) });
    },
  );

  return router;
}
