import { Uuid } from '@quatreros/contracts';
import { Router } from 'express';
import { AppError } from '../../../platform/http/errors.js';
import { expectedVersion } from '../../../platform/http/version.js';
import { requireIdempotency } from '../../../platform/idempotency/middleware.js';
import type { IdempotencyStore } from '../../../platform/idempotency/store.js';
import {
  createPresentation,
  createProduct,
  createRawMaterial,
  getProduct,
  listPrices,
  listProducts,
  listRawMaterials,
  setPrice,
  updatePresentation,
  updateProduct,
  updateRawMaterial,
  type CatalogDeps,
} from '../application/catalog.js';

function id(raw: string | string[] | undefined): string {
  const parsed = Uuid.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success) throw AppError.notFound();
  return parsed.data;
}

export function catalogRouter(deps: CatalogDeps & { idempotency: IdempotencyStore }): Router {
  const router = Router();

  router.get('/catalog/products', async (req, res) => {
    res.json(await listProducts(deps, req.ctx, req.query));
  });

  router.get('/catalog/products/:id', async (req, res) => {
    res.json({ data: await getProduct(deps, req.ctx, id(req.params.id)) });
  });

  router.post('/catalog/products', requireIdempotency(deps.idempotency), async (req, res) => {
    const product = await createProduct(deps, req.ctx, req.body);
    res.setHeader('ETag', `"v${String(product.version)}"`);
    res.status(201).json({ data: product });
  });

  router.patch('/catalog/products/:id', async (req, res) => {
    const product = await updateProduct(
      deps,
      req.ctx,
      id(req.params.id),
      expectedVersion(req.header('if-match')),
      req.body,
    );
    res.setHeader('ETag', `"v${String(product.version)}"`);
    res.json({ data: product });
  });

  router.post(
    '/catalog/products/:id/presentations',
    requireIdempotency(deps.idempotency),
    async (req, res) => {
      const presentation = await createPresentation(deps, req.ctx, id(req.params.id), req.body);
      res.setHeader('ETag', `"v${String(presentation.version)}"`);
      res.status(201).json({ data: presentation });
    },
  );

  router.patch('/catalog/presentations/:id', async (req, res) => {
    const presentation = await updatePresentation(
      deps,
      req.ctx,
      id(req.params.id),
      expectedVersion(req.header('if-match')),
      req.body,
    );
    res.setHeader('ETag', `"v${String(presentation.version)}"`);
    res.json({ data: presentation });
  });

  router.get('/catalog/presentations/:id/prices', async (req, res) => {
    res.json(await listPrices(deps, req.ctx, id(req.params.id)));
  });

  router.post('/catalog/presentations/:id/prices', requireIdempotency(deps.idempotency), async (req, res) => {
    const price = await setPrice(deps, req.ctx, id(req.params.id), req.body);
    res.status(201).json({ data: price });
  });

  router.get('/catalog/raw-materials', async (req, res) => {
    res.json(await listRawMaterials(deps, req.ctx, req.query));
  });

  router.post('/catalog/raw-materials', requireIdempotency(deps.idempotency), async (req, res) => {
    const material = await createRawMaterial(deps, req.ctx, req.body);
    res.setHeader('ETag', `"v${String(material.version)}"`);
    res.status(201).json({ data: material });
  });

  router.patch('/catalog/raw-materials/:id', async (req, res) => {
    const material = await updateRawMaterial(
      deps,
      req.ctx,
      id(req.params.id),
      expectedVersion(req.header('if-match')),
      req.body,
    );
    res.setHeader('ETag', `"v${String(material.version)}"`);
    res.json({ data: material });
  });

  return router;
}
