import type { ProductKind } from '@quatreros/contracts';
import { and, asc, desc, eq, gt, ilike, inArray, isNull, ne, or } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { presentations, priceHistory, products, rawMaterials } from './schema.js';

/** Ejecutor: la base o una transacción en curso. */
export type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

export interface CatalogCursor {
  name: string;
  id: string;
}

export function encodeCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): CatalogCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'name' in parsed &&
      'id' in parsed &&
      typeof parsed.name === 'string' &&
      typeof parsed.id === 'string'
    ) {
      return { name: parsed.name, id: parsed.id };
    }
  } catch {
    // Cursor corrupto: el caso de uso responde 422.
  }
  return null;
}

export interface ProductRow {
  id: string;
  name: string;
  kind: ProductKind;
  baseUnit: string;
  shelfLifeDays: number | null;
  isActive: boolean;
  version: number;
}

export interface PresentationRow {
  id: string;
  productId: string;
  name: string;
  unitsPer: string;
  isActive: boolean;
  version: number;
  priceId: string | null;
  price: string | null;
}

export interface PriceRow {
  id: string;
  presentationId: string;
  price: string;
  validFrom: Date;
  validTo: Date | null;
  setBy: string;
  createdAt: Date;
}

export interface RawMaterialRow {
  id: string;
  name: string;
  unit: string;
  tracksExpiry: boolean;
  isActive: boolean;
  version: number;
}

const productColumns = {
  id: products.id,
  name: products.name,
  kind: products.kind,
  baseUnit: products.baseUnit,
  shelfLifeDays: products.shelfLifeDays,
  isActive: products.isActive,
  version: products.version,
};

const rawMaterialColumns = {
  id: rawMaterials.id,
  name: rawMaterials.name,
  unit: rawMaterials.unit,
  tracksExpiry: rawMaterials.tracksExpiry,
  isActive: rawMaterials.isActive,
  version: rawMaterials.version,
};

export async function listProductRows(
  db: Executor,
  opts: {
    q?: string | undefined;
    kind?: ProductKind | undefined;
    status: 'active' | 'inactive' | 'all';
    limit: number;
    cursor: CatalogCursor | null;
  },
): Promise<ProductRow[]> {
  const conditions = [];
  if (opts.q) conditions.push(ilike(products.name, `%${opts.q}%`));
  if (opts.kind) conditions.push(eq(products.kind, opts.kind));
  if (opts.status !== 'all') conditions.push(eq(products.isActive, opts.status === 'active'));
  if (opts.cursor) {
    conditions.push(
      or(
        gt(products.name, opts.cursor.name),
        and(eq(products.name, opts.cursor.name), gt(products.id, opts.cursor.id)),
      ),
    );
  }
  return db
    .select(productColumns)
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.name), asc(products.id))
    .limit(opts.limit + 1);
}

export async function findProductRow(db: Executor, id: string): Promise<ProductRow | undefined> {
  const [row] = await db.select(productColumns).from(products).where(eq(products.id, id));
  return row;
}

export async function lockProductRow(db: Executor, id: string): Promise<ProductRow | undefined> {
  const [row] = await db.select(productColumns).from(products).where(eq(products.id, id)).for('update');
  return row;
}

export async function productNameInUse(db: Executor, name: string, excludeId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.name, name), excludeId ? ne(products.id, excludeId) : undefined));
  return Boolean(row);
}

export async function presentationsOfProducts(
  db: Executor,
  productIds: string[],
): Promise<PresentationRow[]> {
  if (productIds.length === 0) return [];
  return db
    .select({
      id: presentations.id,
      productId: presentations.productId,
      name: presentations.name,
      unitsPer: presentations.unitsPer,
      isActive: presentations.isActive,
      version: presentations.version,
      priceId: priceHistory.id,
      price: priceHistory.price,
    })
    .from(presentations)
    .leftJoin(
      priceHistory,
      and(eq(priceHistory.presentationId, presentations.id), isNull(priceHistory.validTo)),
    )
    .where(inArray(presentations.productId, productIds))
    .orderBy(asc(presentations.name), asc(presentations.id));
}

export async function findPresentationRow(db: Executor, id: string): Promise<PresentationRow | undefined> {
  const [row] = await db
    .select({
      id: presentations.id,
      productId: presentations.productId,
      name: presentations.name,
      unitsPer: presentations.unitsPer,
      isActive: presentations.isActive,
      version: presentations.version,
      priceId: priceHistory.id,
      price: priceHistory.price,
    })
    .from(presentations)
    .leftJoin(
      priceHistory,
      and(eq(priceHistory.presentationId, presentations.id), isNull(priceHistory.validTo)),
    )
    .where(eq(presentations.id, id));
  return row;
}

/** Bloquea la presentación y su producto para cambios de precio y composición. */
export async function lockPresentationWithProduct(
  db: Executor,
  id: string,
): Promise<
  | {
      id: string;
      productId: string;
      name: string;
      unitsPer: string;
      isActive: boolean;
      version: number;
      productActive: boolean;
    }
  | undefined
> {
  const [row] = await db
    .select({
      id: presentations.id,
      productId: presentations.productId,
      name: presentations.name,
      unitsPer: presentations.unitsPer,
      isActive: presentations.isActive,
      version: presentations.version,
      productActive: products.isActive,
    })
    .from(presentations)
    .innerJoin(products, eq(products.id, presentations.productId))
    .where(eq(presentations.id, id))
    .for('update');
  return row;
}

export async function presentationNameInUse(
  db: Executor,
  productId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: presentations.id })
    .from(presentations)
    .where(
      and(
        eq(presentations.productId, productId),
        eq(presentations.name, name),
        excludeId ? ne(presentations.id, excludeId) : undefined,
      ),
    );
  return Boolean(row);
}

export async function listPriceRows(db: Executor, presentationId: string): Promise<PriceRow[]> {
  return db
    .select({
      id: priceHistory.id,
      presentationId: priceHistory.presentationId,
      price: priceHistory.price,
      validFrom: priceHistory.validFrom,
      validTo: priceHistory.validTo,
      setBy: priceHistory.setBy,
      createdAt: priceHistory.createdAt,
    })
    .from(priceHistory)
    .where(eq(priceHistory.presentationId, presentationId))
    .orderBy(desc(priceHistory.validFrom), desc(priceHistory.id));
}

/** Fila vigente (valid_to NULL) bloqueada para el cambio de precio. */
export async function currentPriceRow(db: Executor, presentationId: string): Promise<PriceRow | undefined> {
  const [row] = await db
    .select({
      id: priceHistory.id,
      presentationId: priceHistory.presentationId,
      price: priceHistory.price,
      validFrom: priceHistory.validFrom,
      validTo: priceHistory.validTo,
      setBy: priceHistory.setBy,
      createdAt: priceHistory.createdAt,
    })
    .from(priceHistory)
    .where(and(eq(priceHistory.presentationId, presentationId), isNull(priceHistory.validTo)))
    .for('update');
  return row;
}

export async function listRawMaterialRows(
  db: Executor,
  opts: {
    q?: string | undefined;
    status: 'active' | 'inactive' | 'all';
    limit: number;
    cursor: CatalogCursor | null;
  },
): Promise<RawMaterialRow[]> {
  const conditions = [];
  if (opts.q) conditions.push(ilike(rawMaterials.name, `%${opts.q}%`));
  if (opts.status !== 'all') conditions.push(eq(rawMaterials.isActive, opts.status === 'active'));
  if (opts.cursor) {
    conditions.push(
      or(
        gt(rawMaterials.name, opts.cursor.name),
        and(eq(rawMaterials.name, opts.cursor.name), gt(rawMaterials.id, opts.cursor.id)),
      ),
    );
  }
  return db
    .select(rawMaterialColumns)
    .from(rawMaterials)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(rawMaterials.name), asc(rawMaterials.id))
    .limit(opts.limit + 1);
}

export async function findRawMaterialRow(db: Executor, id: string): Promise<RawMaterialRow | undefined> {
  const [row] = await db.select(rawMaterialColumns).from(rawMaterials).where(eq(rawMaterials.id, id));
  return row;
}

export async function lockRawMaterialRow(db: Executor, id: string): Promise<RawMaterialRow | undefined> {
  const [row] = await db
    .select(rawMaterialColumns)
    .from(rawMaterials)
    .where(eq(rawMaterials.id, id))
    .for('update');
  return row;
}

export async function rawMaterialNameInUse(db: Executor, name: string, excludeId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: rawMaterials.id })
    .from(rawMaterials)
    .where(and(eq(rawMaterials.name, name), excludeId ? ne(rawMaterials.id, excludeId) : undefined));
  return Boolean(row);
}
