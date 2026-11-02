import { Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import { expectedVersion } from '../../../platform/http/version.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import {
  createCustomer,
  createOrder,
  getOrder,
  listCustomers,
  listOrders,
  updateCredit,
  updateCustomer,
  type SalesDeps,
} from '../application/sales.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function salesRouter(deps: SalesDeps & { idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/sales/customers', async (req, res) => {
    res.json(await listCustomers(deps, req.ctx, req.query));
  });

  router.post('/sales/customers', requireIdempotency(deps.idempotency), async (req, res) => {
    const customer = await createCustomer(deps, req.ctx, req.body);
    res.setHeader('ETag', `"v${String(customer.version)}"`);
    res.status(201).json({ data: customer });
  });

  router.patch('/sales/customers/:id', async (req, res) => {
    const customer = await updateCustomer(
      deps,
      req.ctx,
      id(req.params.id),
      expectedVersion(req.header('if-match')),
      req.body,
    );
    res.setHeader('ETag', `"v${String(customer.version)}"`);
    res.json({ data: customer });
  });

  router.put('/sales/customers/:id/credit', async (req, res) => {
    const customer = await updateCredit(deps, req.ctx, id(req.params.id), req.body);
    res.setHeader('ETag', `"v${String(customer.version)}"`);
    res.json({ data: customer });
  });

  router.get('/sales/orders', async (req, res) => {
    res.json(await listOrders(deps, req.ctx, req.query));
  });

  router.post('/sales/orders', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createOrder(deps, req.ctx, req.body) });
  });

  router.get('/sales/orders/:id', async (req, res) => {
    res.json({ data: await getOrder(deps, req.ctx, id(req.params.id)) });
  });

  return router;
}
