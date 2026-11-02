import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { orders } from './schema.js';

interface DemoRecipe {
  product: string;
  expectedYieldPct: string;
  tolerancePct: string;
  lines: { material: string; quantity: string }[];
}

const DEMO_RECIPES: DemoRecipe[] = [
  {
    product: 'Chorizo Santarrosano',
    expectedYieldPct: '98.00',
    tolerancePct: '3.00',
    lines: [
      { material: 'Carne de cerdo magra', quantity: '10.000' },
      { material: 'Tocino y grasa', quantity: '3.000' },
      { material: 'Mix de especias', quantity: '0.500' },
      { material: 'Tripa natural', quantity: '20.000' },
    ],
  },
  {
    product: 'Rellena Mixta',
    expectedYieldPct: '98.00',
    tolerancePct: '3.00',
    lines: [
      { material: 'Carne de cerdo magra', quantity: '8.000' },
      { material: 'Tocino y grasa', quantity: '4.000' },
      { material: 'Mix de especias', quantity: '0.400' },
      { material: 'Tripa natural', quantity: '15.000' },
    ],
  },
];

/**
 * Recetas de producción y una orden planificada de demostración (prod/produccion §9).
 * Idempotente por producto y número de orden.
 */
export async function seedDemoProduction(db: Database, publishedBy: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (const demo of DEMO_RECIPES) {
      const existing = await tx.execute(sql`
        select r.id from catalog.recipes r
        join catalog.products p on p.id = r.product_id
        where r.kind = 'production' and p.name = ${demo.product}
        limit 1
      `);
      if (existing.rows.length > 0) continue;

      const product = await tx.execute(sql`
        select id from catalog.products where name = ${demo.product} and kind = 'manufactured' limit 1
      `);
      const productId = (product.rows[0] as { id: string } | undefined)?.id;
      if (!productId) continue;

      const recipe = await tx.execute(sql`
        insert into catalog.recipes (kind, product_id) values ('production', ${productId})
        returning id
      `);
      const recipeId = (recipe.rows[0] as { id: string }).id;
      const version = await tx.execute(sql`
        insert into catalog.recipe_versions
          (recipe_id, version, base_output_qty, expected_yield_pct, tolerance_pct, is_current, published_by)
        values (${recipeId}, 1, '100.000', ${demo.expectedYieldPct}, ${demo.tolerancePct}, true, ${publishedBy})
        returning id
      `);
      const versionId = (version.rows[0] as { id: string }).id;
      for (const line of demo.lines) {
        const material = await tx.execute(sql`
          select id from catalog.raw_materials where name = ${line.material} limit 1
        `);
        const materialId = (material.rows[0] as { id: string } | undefined)?.id;
        if (!materialId) continue;
        await tx.execute(sql`
          insert into catalog.recipe_lines (recipe_version_id, raw_material_id, quantity)
          values (${versionId}, ${materialId}, ${line.quantity})
        `);
      }
    }

    const [existingOrder] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.number, 'OP-0001'))
      .limit(1);
    if (!existingOrder) {
      const refs = await tx.execute(sql`
        select p.id as "productId", site.id as "siteId", rv.id as "recipeVersionId",
               u.id as "responsibleId"
        from catalog.products p
        join catalog.recipes r on r.product_id = p.id and r.kind = 'production'
        join catalog.recipe_versions rv on rv.recipe_id = r.id and rv.is_current
        join admin.sites site on site.name = 'Bodega principal'
        join admin.users u on u.email = 'produccion@quatreros.example'
        where p.name = 'Chorizo Santarrosano'
        limit 1
      `);
      const ref = refs.rows[0] as
        { productId: string; siteId: string; recipeVersionId: string; responsibleId: string } | undefined;
      if (ref) {
        await tx.insert(orders).values({
          number: 'OP-0001',
          siteId: ref.siteId,
          productId: ref.productId,
          recipeVersionId: ref.recipeVersionId,
          plannedQty: '100.000',
          responsibleId: ref.responsibleId,
        });
      }
    }

    await tx.execute(sql`
      insert into platform.document_sequences (doc_type, next_value)
      values ('OP', 1), ('PT', 1)
      on conflict (doc_type) do nothing
    `);
    const maxResult = await tx.execute(sql`
      select coalesce(max((regexp_match(number, '^OP-([0-9]+)$'))[1]::int), 0) as "maxValue"
      from production.orders where number ~ '^OP-[0-9]+$'
    `);
    const next = ((maxResult.rows[0] as { maxValue: number } | undefined)?.maxValue ?? 0) + 1;
    await tx.execute(sql`
      update platform.document_sequences set next_value = greatest(next_value, ${next})
      where doc_type = 'OP'
    `);
  });
}
