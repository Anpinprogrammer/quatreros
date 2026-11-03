import { Uuid } from '@quatreros/contracts';
import { Router, type Response } from 'express';
import type { Database } from '../../../platform/db/client.js';
import { AppError } from '../../../platform/http/errors.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import {
  agingReport,
  cajaCsv,
  carteraCsv,
  createPayment,
  createReconciliation,
  financeDashboard,
  getCollection,
  getCustomerBalance,
  getReceivable,
  getReconciliation,
  listCollections,
  listPaymentMethodsForActor,
  listReceivables,
  listReconciliations,
  recaudosCsv,
} from '../application/finance.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

function sendCsv(res: Response, filename: string, body: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

export function financeRouter(deps: { db: Database; idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/finance/receivables/aging', async (req, res) => {
    res.json({ data: await agingReport(deps.db, req.ctx, req.query) });
  });

  router.get('/finance/receivables/customer/:customerId', async (req, res) => {
    res.json({ data: await getCustomerBalance(deps.db, req.ctx, id(req.params.customerId)) });
  });

  router.get('/finance/receivables', async (req, res) => {
    res.json(await listReceivables(deps.db, req.ctx, req.query));
  });

  router.get('/finance/receivables/:id', async (req, res) => {
    res.json({ data: await getReceivable(deps.db, req.ctx, id(req.params.id)) });
  });

  router.get('/finance/collections', async (req, res) => {
    res.json(await listCollections(deps.db, req.ctx, req.query));
  });

  router.post('/finance/collections', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createPayment(deps.db, req.ctx, req.body) });
  });

  router.get('/finance/collections/:id', async (req, res) => {
    res.json({ data: await getCollection(deps.db, req.ctx, id(req.params.id)) });
  });

  router.get('/finance/payment-methods', async (req, res) => {
    res.json({ data: await listPaymentMethodsForActor(deps.db, req.ctx) });
  });

  router.get('/finance/reconciliations', async (req, res) => {
    res.json(await listReconciliations(deps.db, req.ctx, req.query));
  });

  router.post('/finance/reconciliations', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await createReconciliation(deps.db, req.ctx, req.body) });
  });

  router.get('/finance/reconciliations/:id', async (req, res) => {
    res.json({ data: await getReconciliation(deps.db, req.ctx, id(req.params.id)) });
  });

  router.get('/finance/dashboard', async (req, res) => {
    res.json({ data: await financeDashboard(deps.db, req.ctx) });
  });

  router.get('/reports/cartera/export', async (req, res) => {
    sendCsv(res, 'cartera.csv', await carteraCsv(deps.db, req.ctx, req.query));
  });

  router.get('/reports/recaudos/export', async (req, res) => {
    sendCsv(res, 'recaudos.csv', await recaudosCsv(deps.db, req.ctx, req.query));
  });

  router.get('/reports/caja/export', async (req, res) => {
    sendCsv(res, 'caja.csv', await cajaCsv(deps.db, req.ctx, req.query));
  });

  return router;
}
