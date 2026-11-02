import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
/**
 * Esquema `catalog` (database-design §2, especificación cat/catalogo §3).
 * Cantidades NUMERIC(14,3) y dinero NUMERIC(14,2), siempre como cadena decimal (DEC-P22).
 */
export const catalogSchema = pgSchema('catalog');

export const products = catalogSchema.table(
  'products',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull().unique(),
    kind: text({ enum: ['manufactured', 'prepared'] }).notNull(),
    baseUnit: text().notNull(),
    shelfLifeDays: integer(),
    isActive: boolean().notNull().default(true),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('products_kind_chk', sql`${t.kind} IN ('manufactured','prepared')`),
    check('products_shelf_life_chk', sql`${t.shelfLifeDays} IS NULL OR ${t.shelfLifeDays} > 0`),
    check(
      'products_manufactured_shelf_life_chk',
      sql`${t.kind} = 'prepared' OR ${t.shelfLifeDays} IS NOT NULL`,
    ),
    check('products_version_chk', sql`${t.version} > 0`),
  ],
);

export const presentations = catalogSchema.table(
  'presentations',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    name: text().notNull(),
    unitsPer: numeric({ precision: 14, scale: 3 }).notNull(),
    isActive: boolean().notNull().default(true),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('presentations_product_name_uq').on(t.productId, t.name),
    index('presentations_product_idx').on(t.productId),
    check('presentations_units_per_chk', sql`${t.unitsPer} > 0`),
    check('presentations_version_chk', sql`${t.version} > 0`),
  ],
);

export const priceHistory = catalogSchema.table(
  'price_history',
  {
    id: uuid().primaryKey().defaultRandom(),
    presentationId: uuid()
      .notNull()
      .references(() => presentations.id),
    price: numeric({ precision: 14, scale: 2 }).notNull(),
    validFrom: timestamp({ withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp({ withTimezone: true }),
    // FK lógica a admin.users: la frontera de módulos no permite importar su esquema.
    // La restricción real se crea en la migración 0005_catalog_grants.sql.
    setBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('price_history_presentation_idx').on(t.presentationId, t.validFrom),
    uniqueIndex('price_history_current_uq')
      .on(t.presentationId)
      .where(sql`${t.validTo} IS NULL`),
    check('price_history_price_chk', sql`${t.price} > 0`),
    check('price_history_validity_chk', sql`${t.validTo} IS NULL OR ${t.validTo} > ${t.validFrom}`),
  ],
);

export const rawMaterials = catalogSchema.table(
  'raw_materials',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull().unique(),
    unit: text().notNull(),
    tracksExpiry: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('raw_materials_version_chk', sql`${t.version} > 0`)],
);
