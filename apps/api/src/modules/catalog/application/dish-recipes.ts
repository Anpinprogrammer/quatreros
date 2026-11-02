import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { AppError } from '../../../platform/http/errors.js';
import { recipeLines, recipeVersions, recipes } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface DishComponentInput {
  rawMaterialId?: string | undefined;
  presentationId?: string | undefined;
  quantity: string;
}

export interface DishRecipeLine {
  rawMaterialId: string | null;
  presentationId: string | null;
  name: string;
  unit: string;
  quantity: string;
}

export interface DishRecipeVersion {
  id: string;
  version: number;
  baseOutputQty: string;
  isCurrent: boolean;
  publishedAt: string;
  components: DishRecipeLine[];
}

export interface DishRecipe {
  id: string;
  productId: string;
  productName: string;
  currentVersion: DishRecipeVersion;
  versions?: DishRecipeVersion[];
}

export interface CurrentDishRecipe {
  recipeId: string;
  recipeVersionId: string;
  recipeVersion: number;
  productId: string;
  productName: string;
  baseOutputQty: string;
  lines: DishRecipeLine[];
}

interface RecipeRow {
  id: string;
  productId: string;
  productName: string;
}

interface VersionRow {
  id: string;
  recipeId: string;
  version: number;
  baseOutputQty: string;
  isCurrent: boolean;
  publishedAt: Date | string;
}

interface ComponentRow {
  recipeVersionId: string;
  rawMaterialId: string | null;
  presentationId: string | null;
  rawMaterialName: string | null;
  rawMaterialUnit: string | null;
  productName: string | null;
  presentationName: string | null;
  quantity: string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function validation(detail: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);
}

function componentFromRow(row: ComponentRow): DishRecipeLine {
  if (row.rawMaterialId) {
    return {
      rawMaterialId: row.rawMaterialId,
      presentationId: null,
      name: row.rawMaterialName ?? 'Materia prima',
      unit: row.rawMaterialUnit ?? 'unidad',
      quantity: row.quantity,
    };
  }
  return {
    rawMaterialId: null,
    presentationId: row.presentationId,
    name: `${row.productName ?? 'Producto'} · ${row.presentationName ?? 'Presentación'}`,
    unit: row.presentationName ?? 'presentación',
    quantity: row.quantity,
  };
}

async function versionsForRecipes(db: Executor, recipeIds: string[]): Promise<VersionRow[]> {
  if (recipeIds.length === 0) return [];
  const result = await db.execute(sql`
    select id, recipe_id as "recipeId", version, base_output_qty as "baseOutputQty",
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

async function componentsForVersions(db: Executor, versionIds: string[]): Promise<ComponentRow[]> {
  if (versionIds.length === 0) return [];
  const result = await db.execute(sql`
    select rl.recipe_version_id as "recipeVersionId",
           rl.raw_material_id as "rawMaterialId", rl.presentation_id as "presentationId",
           rm.name as "rawMaterialName", rm.unit as "rawMaterialUnit",
           p.name as "productName", pr.name as "presentationName",
           rl.quantity
    from catalog.recipe_lines rl
    left join catalog.raw_materials rm on rm.id = rl.raw_material_id
    left join catalog.presentations pr on pr.id = rl.presentation_id
    left join catalog.products p on p.id = pr.product_id
    where rl.recipe_version_id in (${sql.join(
      versionIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by coalesce(rm.name, p.name) asc, coalesce(pr.name, '') asc
  `);
  return result.rows as unknown as ComponentRow[];
}

function versionView(row: VersionRow, components: ComponentRow[]): DishRecipeVersion {
  return {
    id: row.id,
    version: row.version,
    baseOutputQty: row.baseOutputQty,
    isCurrent: row.isCurrent,
    publishedAt: iso(row.publishedAt),
    components: components.filter((component) => component.recipeVersionId === row.id).map(componentFromRow),
  };
}

async function productForDish(
  tx: Executor,
  productId: string,
): Promise<{ id: string; name: string; kind: string; isActive: boolean } | undefined> {
  const result = await tx.execute(sql`
    select id, name, kind, is_active as "isActive"
    from catalog.products where id = ${productId} limit 1
  `);
  return (result.rows as unknown as { id: string; name: string; kind: string; isActive: boolean }[])[0];
}

async function validateComponents(tx: Executor, components: DishComponentInput[]): Promise<void> {
  const materialIds = components
    .filter((component) => component.rawMaterialId)
    .map((component) => component.rawMaterialId as string);
  const presentationIds = components
    .filter((component) => component.presentationId)
    .map((component) => component.presentationId as string);

  if (new Set(materialIds).size !== materialIds.length) {
    throw validation('Cada materia prima debe aparecer una sola vez en la receta.');
  }
  if (new Set(presentationIds).size !== presentationIds.length) {
    throw validation('Cada presentación debe aparecer una sola vez en la receta.');
  }
  if (materialIds.length > 0) {
    const result = await tx.execute(sql`
      select id, name, is_active as "isActive" from catalog.raw_materials
      where id in (${sql.join(
        materialIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    const rows = result.rows as unknown as { id: string; name: string; isActive: boolean }[];
    if (rows.length !== materialIds.length) throw AppError.notFound();
    const inactive = rows.find((row) => !row.isActive);
    if (inactive) {
      throw AppError.conflict(
        'RAW_MATERIAL_INACTIVE',
        'Materia prima inactiva',
        `Reactiva ${inactive.name} antes de usarla en una receta.`,
      );
    }
  }
  if (presentationIds.length > 0) {
    const result = await tx.execute(sql`
      select pr.id, pr.name, p.name as "productName", pr.is_active as "presentationActive",
             p.is_active as "productActive"
      from catalog.presentations pr
      join catalog.products p on p.id = pr.product_id
      where pr.id in (${sql.join(
        presentationIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    const rows = result.rows as unknown as {
      id: string;
      name: string;
      productName: string;
      presentationActive: boolean;
      productActive: boolean;
    }[];
    if (rows.length !== presentationIds.length) throw AppError.notFound();
    const inactive = rows.find((row) => !row.presentationActive || !row.productActive);
    if (inactive) {
      throw AppError.conflict(
        'PRODUCT_INACTIVE',
        'Producto inactivo',
        `Reactiva ${inactive.productName} · ${inactive.name} antes de usarlo en una receta.`,
      );
    }
  }
}

function lineValues(versionId: string, components: DishComponentInput[]) {
  return components.map((component) => ({
    recipeVersionId: versionId,
    rawMaterialId: component.rawMaterialId ?? null,
    presentationId: component.presentationId ?? null,
    quantity: component.quantity,
  }));
}

/** Crea la receta de un plato (kind='dish') y su primera versión. */
export async function createDishRecipeRow(
  tx: Executor,
  input: { productId: string; baseOutputQty: string; components: DishComponentInput[] },
  publishedBy: string,
): Promise<string> {
  const product = await productForDish(tx, input.productId);
  if (!product) throw AppError.notFound();
  if (product.kind !== 'prepared') {
    throw validation('Las recetas de platos solo aplican a productos preparados.');
  }
  if (!product.isActive) {
    throw AppError.conflict(
      'PRODUCT_INACTIVE',
      'Producto inactivo',
      'Reactiva el producto antes de crear su receta.',
    );
  }
  const existing = await tx.execute(sql`
    select 1 from catalog.recipes where kind = 'dish' and product_id = ${input.productId} limit 1
  `);
  if (existing.rows.length > 0) {
    throw AppError.conflict(
      'RECIPE_EXISTS',
      'Receta existente',
      'Ese plato ya tiene una receta. Publica una versión nueva.',
    );
  }
  await validateComponents(tx, input.components);

  const [recipe] = await tx
    .insert(recipes)
    .values({ kind: 'dish', productId: input.productId })
    .returning({ id: recipes.id });
  if (!recipe) throw new Error('No se pudo crear la receta del plato');
  const [version] = await tx
    .insert(recipeVersions)
    .values({
      recipeId: recipe.id,
      version: 1,
      baseOutputQty: input.baseOutputQty,
      isCurrent: true,
      publishedBy,
    })
    .returning({ id: recipeVersions.id });
  if (!version) throw new Error('No se pudo crear la versión de la receta');
  await tx.insert(recipeLines).values(lineValues(version.id, input.components));
  return recipe.id;
}

/** Publica una nueva versión de una receta de plato; las anteriores quedan inmutables. */
export async function createDishRecipeVersionRow(
  tx: Executor,
  recipeId: string,
  input: { baseOutputQty: string; components: DishComponentInput[] },
  publishedBy: string,
): Promise<void> {
  const recipeResult = await tx.execute(sql`
    select r.id, p.id as "productId", p.is_active as "isActive"
    from catalog.recipes r
    join catalog.products p on p.id = r.product_id
    where r.id = ${recipeId} and r.kind = 'dish'
    for update of r
  `);
  const recipe = (recipeResult.rows as unknown as { id: string; productId: string; isActive: boolean }[])[0];
  if (!recipe) throw AppError.notFound();
  if (!recipe.isActive) {
    throw AppError.conflict(
      'PRODUCT_INACTIVE',
      'Producto inactivo',
      'Reactiva el producto antes de publicar una versión nueva.',
    );
  }
  await validateComponents(tx, input.components);

  const maxResult = await tx.execute(sql`
    select coalesce(max(version), 0) as "maxVersion" from catalog.recipe_versions
    where recipe_id = ${recipeId}
  `);
  const nextVersion = ((maxResult.rows[0] as { maxVersion: number } | undefined)?.maxVersion ?? 0) + 1;
  await tx.update(recipeVersions).set({ isCurrent: false }).where(eq(recipeVersions.recipeId, recipeId));
  const [version] = await tx
    .insert(recipeVersions)
    .values({
      recipeId,
      version: nextVersion,
      baseOutputQty: input.baseOutputQty,
      isCurrent: true,
      publishedBy,
    })
    .returning({ id: recipeVersions.id });
  if (!version) throw new Error('No se pudo publicar la versión de la receta');
  await tx.insert(recipeLines).values(lineValues(version.id, input.components));
}

async function recipeRows(db: Executor, recipeIds?: string[]): Promise<RecipeRow[]> {
  const filter = recipeIds
    ? sql`and r.id in (${sql.join(
        recipeIds.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql``;
  const result = await db.execute(sql`
    select r.id, r.product_id as "productId", p.name as "productName"
    from catalog.recipes r
    join catalog.products p on p.id = r.product_id
    where r.kind = 'dish'
      ${filter}
    order by p.name asc
  `);
  return result.rows as unknown as RecipeRow[];
}

export async function listDishRecipes(
  db: Executor,
  query: { q?: string | undefined; limit: number },
): Promise<DishRecipe[]> {
  const result = await db.execute(sql`
    select r.id, r.product_id as "productId", p.name as "productName"
    from catalog.recipes r
    join catalog.products p on p.id = r.product_id
    join catalog.recipe_versions rv on rv.recipe_id = r.id and rv.is_current
    where r.kind = 'dish'
      ${query.q ? sql`and p.name ilike ${`%${query.q}%`}` : sql``}
    order by p.name asc
    limit ${query.limit}
  `);
  const rows = result.rows as unknown as RecipeRow[];
  const versions = await versionsForRecipes(
    db,
    rows.map((row) => row.id),
  );
  const components = await componentsForVersions(
    db,
    versions.map((version) => version.id),
  );
  return rows.flatMap((row) => {
    const current = versions.find((version) => version.recipeId === row.id && version.isCurrent);
    if (!current) return [];
    return [{ ...row, currentVersion: versionView(current, components) }];
  });
}

export async function getDishRecipe(db: Executor, id: string): Promise<DishRecipe | undefined> {
  const rows = await recipeRows(db, [id]);
  const row = rows[0];
  if (!row) return undefined;
  const versions = await versionsForRecipes(db, [id]);
  const components = await componentsForVersions(
    db,
    versions.map((version) => version.id),
  );
  const current = versions.find((version) => version.isCurrent);
  if (!current) return undefined;
  return {
    ...row,
    currentVersion: versionView(current, components),
    versions: versions.map((version) => versionView(version, components)),
  };
}

/** Receta vigente de un plato para calcular el consumo teórico al vender. */
export async function loadCurrentDishRecipe(
  db: Executor,
  productId: string,
): Promise<CurrentDishRecipe | undefined> {
  const result = await db.execute(sql`
    select r.id as "recipeId", rv.id as "recipeVersionId", rv.version as "recipeVersion",
           p.id as "productId", p.name as "productName", rv.base_output_qty as "baseOutputQty"
    from catalog.recipes r
    join catalog.recipe_versions rv on rv.recipe_id = r.id and rv.is_current
    join catalog.products p on p.id = r.product_id
    where r.kind = 'dish' and r.product_id = ${productId}
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
    }[]
  )[0];
  if (!row) return undefined;
  const components = await componentsForVersions(db, [row.recipeVersionId]);
  return {
    ...row,
    lines: components.map(componentFromRow),
  };
}
