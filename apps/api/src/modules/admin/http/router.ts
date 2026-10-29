import { UserListQuery, Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import { AppError } from '../../../platform/http/errors.js';
import {
  createUser,
  getMe,
  listRoles,
  listSitesUseCase,
  listUsersUseCase,
  setUserActive,
  updateUser,
  type UsersDeps,
} from '../application/users.js';

/** Versión esperada desde If-Match (ETag "v<n>"), para edición concurrente segura. */
function expectedVersion(header: string | undefined): number | undefined {
  if (!header) return undefined;
  const match = /^"?v?(\d+)"?$/.exec(header.trim());
  if (!match?.[1])
    throw new AppError(400, 'MALFORMED_REQUEST', 'If-Match inválido', 'Usa el valor ETag recibido.');
  return Number(match[1]);
}

function userId(raw: string | undefined): string {
  const parsed = Uuid.safeParse(raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function adminRouter(deps: UsersDeps & { idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/me', async (req, res) => {
    res.json(await getMe(deps, req.ctx));
  });

  router.get('/admin/users', async (req, res) => {
    const query = UserListQuery.parse(req.query);
    res.json({ data: await listUsersUseCase(deps, req.ctx, query) });
  });

  router.post('/admin/users', requireIdempotency(deps.idempotency), async (req, res) => {
    const user = await createUser(deps, req.ctx, req.body);
    res.setHeader('ETag', `"v${user.version}"`);
    res.status(201).json({ data: user });
  });

  router.patch('/admin/users/:id', async (req, res) => {
    const user = await updateUser(
      deps,
      req.ctx,
      userId(req.params.id),
      expectedVersion(req.header('if-match')),
      req.body,
    );
    res.setHeader('ETag', `"v${user.version}"`);
    res.json({ data: user });
  });

  router.post('/admin/users/:id/deactivate', async (req, res) => {
    res.json({ data: await setUserActive(deps, req.ctx, userId(req.params.id), false) });
  });

  router.post('/admin/users/:id/reactivate', async (req, res) => {
    res.json({ data: await setUserActive(deps, req.ctx, userId(req.params.id), true) });
  });

  router.get('/admin/roles', async (req, res) => {
    res.json({ data: await listRoles(deps, req.ctx) });
  });

  router.get('/admin/sites', async (req, res) => {
    res.json({ data: await listSitesUseCase(deps, req.ctx) });
  });

  return router;
}
