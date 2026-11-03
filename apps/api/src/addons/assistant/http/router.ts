import { Router, type Response } from 'express';
import type { AppDeps } from '../../../app.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import { TurnHub } from '../application/hub.js';
import { AssistantService } from '../application/service.js';
import { TurnRunner } from '../application/runner.js';
import type { AssistantDb } from '../application/ports.js';
import { AnthropicAssistantProvider } from '../infrastructure/anthropic/client.js';
import { ToolGateway } from '../../tool-gateway/application/gateway.js';

function param(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}

function writeEvent(res: Response, id: number, event: unknown): void {
  res.write(`id: ${id}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function assistantRouter(deps: AppDeps): Router {
  const router = Router();
  if (!deps.db) return router;
  const db = deps.db as unknown as AssistantDb;
  const hub = new TurnHub();
  const provider = deps.assistantProvider ?? new AnthropicAssistantProvider(deps.env);
  const gateway = new ToolGateway(deps.db);
  const runner = new TurnRunner(db, provider, gateway, hub, deps.env);
  const service = new AssistantService(db, provider, gateway, hub, runner, deps.env, deps.flags);

  router.get('/assistant/status', async (req, res) => {
    res.json({ data: await service.status(req.ctx) });
  });

  router.get('/assistant/settings', async (req, res) => {
    res.json({ data: await service.settings(req.ctx) });
  });

  router.put('/assistant/settings', async (req, res) => {
    res.json({ data: await service.updateSettings(req.ctx, req.body) });
  });

  router.get('/assistant/tickets', async (req, res) => {
    res.json(await service.listTickets(req.ctx, req.query));
  });

  router.post('/assistant/tickets', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(201).json({ data: await service.createTicket(req.ctx, req.body) });
  });

  router.post('/assistant/tickets/:id/messages', requireIdempotency(deps.idempotency), async (req, res) => {
    res.status(202).json({
      data: await service.sendMessage(req.ctx, param(req.params.id), req.body),
    });
  });

  router.get('/assistant/tickets/:id/stream', async (req, res) => {
    const { ticket, replay } = await service.stream(req.ctx, param(req.params.id));
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const last = Number(req.header('last-event-id') ?? req.query.lastEventId ?? 0);
    const pending = last > 0 ? replay.filter((entry) => entry.id > last) : replay;
    for (const entry of pending) writeEvent(res, entry.id, entry.event);
    const unsubscribe = hub.subscribe(ticket.id, (entry) => {
      writeEvent(res, entry.id, entry.event);
    });
    const heartbeat = setInterval(() => {
      writeEvent(res, 0, { type: 'heartbeat', data: {} });
    }, 15_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  router.post('/assistant/proposals/:id/confirm', async (req, res) => {
    res.json({ data: await service.confirmProposal(req.ctx, param(req.params.id)) });
  });

  router.post('/assistant/proposals/:id/cancel', async (req, res) => {
    res.json({ data: await service.cancelProposal(req.ctx, param(req.params.id)) });
  });

  router.get('/assistant/usage', async (req, res) => {
    res.json({ data: await service.usage(req.ctx, req.query) });
  });

  return router;
}
