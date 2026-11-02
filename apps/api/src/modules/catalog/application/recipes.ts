import {
  CreateRecipeRequest,
  CreateRecipeVersionRequest,
  RecipeListQuery,
  type RecipeDetail,
  type RecipeLineView,
  type RecipePage,
  type RecipeSummary,
  type RecipeVersionView,
} from '@quatreros/contracts';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize } from '../../admin/application/public.js';
import { recipeLines, recipeVersions, recipes } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface RecipeDeps {
  db: Database;
}

interface RecipeRow {
  id: string;
  productId: string;
  productName: string;
  baseUnit: RecipeSummary['baseUnit'];
}

interface VersionRow {
  id: string;
  recipeId: string;
  version: number;
  baseOutputQty: string;
  expectedYieldPct: string;
  tolerancePct: string;
  isCurrent: boolean;
  publishedAt: Date | string;
}

interface LineRow {
  recipeVersionId: string;
  rawMaterialId: string;
  rawMaterialName: string;
  unit: RecipeLineView['unit'];
  quantity: string;
}

export interface ProductionRecipe {
  recipeId: string;
  recipeVersionId: string;
  recipeVersion: number;
  productId: string;
  productName: string;
  baseOutputQty: string;
  expectedYieldPct: string;
  tolerancePct: string;
  lines: { rawMaterialId: string; rawMaterialName: string; unit: RecipeLineView['unit']; quantity: string }[];
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function validation(detail: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);
}

async function productForRecipe(
  tx: Executor,
  productId: string,
): Promise<{ id: string; name: string; kind: string; baseUnit: string; isActive: boolean } | undefined> {
  const result = await tx.execute(sql`
    select id, name, kind, base_unit as "baseUnit", is_active as "isActive"
    from catalog.products where id = ${productId} limit 1
  `);
  return (
    result.rows as unknown as {
      id: string;
      name: string;
      kind: string;
      baseUnit: string;
      isActive: boolean;
    }[]
  )[0];
}

async function validateLines(
  tx: Executor,
  lines: { rawMaterialId: string; quantity: string }[],
): Promise<void> {
  const ids = lines.map((line) => line.rawMaterialId);
  if (new Set(ids).size !== ids.length) {
    throw validation('Cada materia prima debe aparecer una sola vez en la receta.');
  }
  const result = await tx.execute(sql`
    select id, name, is_active as "isActive" from catalog.raw_materials
    where id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})
  `);
  const materials = result.rows as unknown as { id: string; name: string; isActive: boolean }[];
  if (materials.length !== ids.length) throw AppError.notFound();
  const inactive = materials.find((material) => !material.isActive);
  if (inactive) {
    throw AppError.conflict(
      'RAW_MATERIAL_INACTIVE',
      'Materia prima inactiva',
      `Reactiva ${inactive.name} antes de usarla en una receta.`,
    );
  }
}

async function versionRows(db: Executor, recipeIds: string[]): Promise<VersionRow[]> {
  if (recipeIds.length === 0) return [];
  const result = await db.execute(sql`
    select id, recipe_id as "recipeId", version, base_output_qty as "baseOutputQty",
           expected_yield_pct as "expectedYieldPct", tolerance_pct as "tolerancePct",
           is_current as "isCurrent", published_at as "publishedAt"
    from catalog.recipe_versions
    where recipe_id in (${sql.join(
      recipeIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by version desc
  `);
  return result.rows as unknown as VersionRow[];
}

async function lineRows(db: Executor, versionIds: string[]): Promise<LineRow[]> {
  if (versionIds.length === 0) return [];
  const result = await db.execute(sql`
    select rl.recipe_version_id as "recipeVersionId", rl.raw_material_id as "rawMaterialId",
           rm.name as "rawMaterialName", rm.unit, rl.quantity
    from catalog.recipe_lines rl
    join catalog.raw_materials rm on rm.id = rl.raw_material_id
    where rl.recipe_version_id in (${sql.join(
      versionIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by rm.name asc
  `);
  return result.rows as unknown as LineRow[];
}

function toVersion(row: VersionRow, lines: LineRow[]): RecipeVersionView {
  return {
    id: row.id,
    version: row.version,
    baseOutputQty: row.baseOutputQty,
    expectedYieldPct: row.expectedYieldPct,
    tolerancePct: row.tolerancePct,
    isCurrent: row.isCurrent,
    publishedAt: iso(row.publishedAt),
    lines: lines
      .filter((line) => line.recipeVersionId === row.id)
      .map((line) => ({
        rawMaterialId: line.rawMaterialId,
        rawMaterialName: line.rawMaterialName,
        unit: line.unit,
        quantity: line.quantity,
      })),
  };
}

function toSummary(row: RecipeRow, current: RecipeVersionView): RecipeSummary {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    baseUnit: row.baseUnit,
    currentVersion: {
      id: current.id,
      version: current.version,
      baseOutputQty: current.baseOutputQty,
      expectedYieldPct: current.expectedYieldPct,
      tolerancePct: current.tolerancePct,
      isCurrent: current.isCurrent,
      publishedAt: current.publishedAt,
    },
  };
}

export async function listRecipes(
  deps: RecipeDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<RecipePage> {
  authorize(ctx, 'prod.recipe.read');
  const query = RecipeListQuery.parse(raw);
  const result = await deps.db.execute(sql`
    select r.id, p.id as "productId", p.name as "productName", p.base_unit as "baseUnit"
    from catalog.recipes r
    join catalog.products p on p.id = r.product_id
    join catalog.recipe_versions rv on rv.recipe_id = r.id and rv.is_current
    where r.kind = 'production'
      ${query.q ? sql`and p.name ilike ${`%${query.q}%`}` : sql``}
    order by p.name asc
    limit ${query.limit}
  `);
  const rows = result.rows as unknown as RecipeRow[];
  const versions = await versionRows(
    deps.db,
    rows.map((row) => row.id),
  );
  const lines = await lineRows(
    deps.db,
    versions.map((version) => version.id),
  );
  const data = rows.flatMap((row) => {
    const current = versions.find((version) => version.recipeId === row.id && version.isCurrent);
    if (!current) return [];
    return [toSummary(row, toVersion(current, lines))];
  });
  return { data, page: { nextCursor: null, limit: query.limit } };
}

export async function getRecipe(deps: RecipeDeps, ctx: ExecutionContext, id: string): Promise<RecipeDetail> {
  authorize(ctx, 'prod.recipe.read');
  const result = await deps.db.execute(sql`
    select r.id, p.id as "productId", p.name as "productName", p.base_unit as "baseUnit"
    from catalog.recipes r
    join catalog.products p on p.id = r.product_id
    where r.id = ${id} and r.kind = 'production'
    limit 1
  `);
  const row = (result.rows as unknown as RecipeRow[])[0];
  if (!row) throw AppError.notFound();
  const versions = await versionRows(deps.db, [id]);
  const lines = await lineRows(
    deps.db,
    versions.map((version) => version.id),
  );
  const current = versions.find((version) => version.isCurrent);
  if (!current) throw AppError.notFound();
  return {
    ...toSummary(row, toVersion(current, lines)),
    versions: versions.map((version) => toVersion(version, lines)),
  };
}

export async function createRecipe(
  deps: RecipeDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<RecipeDetail> {
  const actor = authorize(ctx, 'prod.recipe.manage');
  const input = CreateRecipeRequest.parse(raw);

  const id = await deps.db.transaction(async (tx) => {
    const product = await productForRecipe(tx, input.productId);
    if (!product) throw AppError.notFound();
    if (product.kind !== 'manufactured') {
      throw validation('Las recetas de producción solo aplican a productos fabricados.');
    }
    if (!product.isActive) {
      throw AppError.conflict(
        'PRODUCT_INACTIVE',
        'Producto inactivo',
        'Reactiva el producto antes de crear su receta.',
      );
    }
    const existing = await tx.execute(sql`
      select 1 from catalog.recipes where kind = 'production' and product_id = ${input.productId} limit 1
    `);
    if (existing.rows.length > 0) {
      throw AppError.conflict(
        'RECIPE_EXISTS',
        'Receta existente',
        'Ese producto ya tiene una receta de producción. Publica una versión nueva.',
      );
    }
    await validateLines(tx, input.lines);

    const [recipe] = await tx
      .insert(recipes)
      .values({ kind: 'production', productId: input.productId })
      .returning({ id: recipes.id });
    if (!recipe) throw new Error('No se pudo crear la receta');
    const [version] = await tx
      .insert(recipeVersions)
      .values({
        recipeId: recipe.id,
        version: 1,
        baseOutputQty: input.baseOutputQty,
        expectedYieldPct: input.expectedYieldPct ?? '100.00',
        tolerancePct: input.tolerancePct ?? '3.00',
        isCurrent: true,
        publishedBy: actor.userId,
      })
      .returning({ id: recipeVersions.id });
    if (!version) throw new Error('No se pudo crear la versión de receta');
    await tx.insert(recipeLines).values(
      input.lines.map((line) => ({
        recipeVersionId: version.id,
        rawMaterialId: line.rawMaterialId,
        quantity: line.quantity,
      })),
    );
    await recordAudit(tx, ctx, {
      action: 'prod.recipe.create',
      entityType: 'catalog.recipe',
      entityId: recipe.id,
      after: { version: 1, ...input },
    });
    return recipe.id;
  });

  return getRecipe(deps, ctx, id);
}

export async function createRecipeVersion(
  deps: RecipeDeps,
  ctx: ExecutionContext,
  id: string,
  raw: unknown,
): Promise<RecipeDetail> {
  const actor = authorize(ctx, 'prod.recipe.manage');
  const input = CreateRecipeVersionRequest.parse(raw);

  await deps.db.transaction(async (tx) => {
    const recipeResult = await tx.execute(sql`
      select r.id, p.is_active as "isActive"
      from catalog.recipes r
      join catalog.products p on p.id = r.product_id
      where r.id = ${id} and r.kind = 'production'
      for update of r
    `);
    const recipe = (recipeResult.rows as unknown as { id: string; isActive: boolean }[])[0];
    if (!recipe) throw AppError.notFound();
    if (!recipe.isActive) {
      throw AppError.conflict(
        'PRODUCT_INACTIVE',
        'Producto inactivo',
        'Reactiva el producto antes de publicar una versión nueva.',
      );
    }
    await validateLines(tx, input.lines);

    const maxResult = await tx.execute(sql`
      select coalesce(max(version), 0) as "maxVersion" from catalog.recipe_versions
      where recipe_id = ${id}
    `);
    const nextVersion = ((maxResult.rows[0] as { maxVersion: number } | undefined)?.maxVersion ?? 0) + 1;
    await tx.update(recipeVersions).set({ isCurrent: false }).where(eq(recipeVersions.recipeId, id));
    const [version] = await tx
      .insert(recipeVersions)
      .values({
        recipeId: id,
        version: nextVersion,
        baseOutputQty: input.baseOutputQty,
        expectedYieldPct: input.expectedYieldPct ?? '100.00',
        tolerancePct: input.tolerancePct ?? '3.00',
        isCurrent: true,
        publishedBy: actor.userId,
      })
      .returning({ id: recipeVersions.id });
    if (!version) throw new Error('No se pudo publicar la versión de receta');
    await tx.insert(recipeLines).values(
      input.lines.map((line) => ({
        recipeVersionId: version.id,
        rawMaterialId: line.rawMaterialId,
        quantity: line.quantity,
      })),
    );
    await recordAudit(tx, ctx, {
      action: 'prod.recipe.version',
      entityType: 'catalog.recipe',
      entityId: id,
      after: { version: nextVersion, ...input },
    });
  });

  return getRecipe(deps, ctx, id);
}

/** Lectura para el módulo de producción: receta vigente de un producto fabricado. */
export async function loadCurrentProductionRecipe(
  db: Executor,
  productId: string,
): Promise<ProductionRecipe | undefined> {
  const result = await db.execute(sql`
    select r.id as "recipeId", rv.id as "recipeVersionId", rv.version as "recipeVersion",
           p.id as "productId", p.name as "productName",
           rv.base_output_qty as "baseOutputQty",
           rv.expected_yield_pct as "expectedYieldPct",
           rv.tolerance_pct as "tolerancePct"
    from catalog.recipes r
    join catalog.recipe_versions rv on rv.recipe_id = r.id and rv.is_current
    join catalog.products p on p.id = r.product_id
    where r.kind = 'production' and r.product_id = ${productId}
    limit 1
  `);
  const row = (
    result.rows as unknown as {
      recipeId: string;
      recipeVersionId: string;
      recipeVersion: number;
      productId: string;
      productName: string;
      baseOutputQty: string;
      expectedYieldPct: string;
      tolerancePct: string;
    }[]
  )[0];
  if (!row) return undefined;
  const lines = await db.execute(sql`
    select rl.raw_material_id as "rawMaterialId", rm.name as "rawMaterialName", rm.unit, rl.quantity
    from catalog.recipe_lines rl
    join catalog.raw_materials rm on rm.id = rl.raw_material_id
    where rl.recipe_version_id = ${row.recipeVersionId}
    order by rm.name
  `);
  return {
    ...row,
    lines: lines.rows as unknown as ProductionRecipe['lines'],
  };
}

/** Lectura para producción: una versión concreta congelada por la orden (BR-062). */
export async function loadProductionRecipeVersion(
  db: Executor,
  recipeVersionId: string,
): Promise<ProductionRecipe | undefined> {
  const result = await db.execute(sql`
    select r.id as "recipeId", rv.id as "recipeVersionId", rv.version as "recipeVersion",
           p.id as "productId", p.name as "productName",
           rv.base_output_qty as "baseOutputQty",
           rv.expected_yield_pct as "expectedYieldPct",
           rv.tolerance_pct as "tolerancePct"
    from catalog.recipe_versions rv
    join catalog.recipes r on r.id = rv.recipe_id
    join catalog.products p on p.id = r.product_id
    where rv.id = ${recipeVersionId} and r.kind = 'production'
    limit 1
  `);
  const row = (result.rows as unknown as Omit<ProductionRecipe, 'lines'>[])[0];
  if (!row) return undefined;
  const lines = await db.execute(sql`
    select rl.raw_material_id as "rawMaterialId", rm.name as "rawMaterialName", rm.unit, rl.quantity
    from catalog.recipe_lines rl
    join catalog.raw_materials rm on rm.id = rl.raw_material_id
    where rl.recipe_version_id = ${recipeVersionId}
    order by rm.name
  `);
  return { ...row, lines: lines.rows as unknown as ProductionRecipe['lines'] };
}
