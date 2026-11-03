import { sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';

/**
 * Semilla de caja (pos/caja §9): receta de plato y un turno cerrado con diferencia
 * para demostrar la revisión. No abre turno: la demo lo abre para vender.
 * Idempotente por receta de plato y por el turno de caja.
 */
export async function seedDemoPos(db: Database, publishedBy: string): Promise<void> {
  await db.transaction(async (tx) => {
    const refsResult = await tx.execute(sql`
      select
        (select id from admin.sites where name = 'Punto de asados') as "siteId",
        (select id from admin.users where email = 'caja@quatreros.example') as "cashierId",
        (select p.id from catalog.products p where p.name = 'Picada Quatreros XL') as "productId",
        (select p.name from catalog.products p where p.name = 'Picada Quatreros XL') as "productName",
        (select pr.id from catalog.presentations pr
          join catalog.products p on p.id = pr.product_id
          where p.name = 'Picada Quatreros XL' and pr.name = 'Porción') as "presentationId",
        (select ph.price from catalog.price_history ph
          join catalog.presentations pr on pr.id = ph.presentation_id
          join catalog.products p on p.id = pr.product_id
          where p.name = 'Picada Quatreros XL' and pr.name = 'Porción' and ph.valid_to is null) as price,
        (select pr.id from catalog.presentations pr
          join catalog.products p on p.id = pr.product_id
          where p.name = 'Chorizo Santarrosano' and pr.name = 'Unidad') as "chorizoPresentationId",
        (select pr.id from catalog.presentations pr
          join catalog.products p on p.id = pr.product_id
          where p.name = 'Rellena Mixta' and pr.name = 'Unidad') as "rellenaUnitId",
        (select id from finance.payment_methods where name = 'Efectivo') as "cashMethodId",
        (select id from finance.payment_methods where name = 'Transferencia') as "transferMethodId"
    `);
    const refs = refsResult.rows[0] as
      | {
          siteId: string;
          cashierId: string;
          productId: string;
          presentationId: string;
          price: string;
          chorizoPresentationId: string;
          rellenaUnitId: string;
          cashMethodId: string;
          transferMethodId: string;
        }
      | undefined;
    if (
      !refs?.siteId ||
      !refs.cashierId ||
      !refs.productId ||
      !refs.presentationId ||
      !refs.price ||
      !refs.chorizoPresentationId ||
      !refs.rellenaUnitId ||
      !refs.cashMethodId ||
      !refs.transferMethodId
    ) {
      throw new Error('La semilla de caja necesita el sitio, la cajera, el plato y los medios de pago');
    }

    let recipe = (
      await tx.execute(sql`
        select r.id as "recipeId", rv.id as "recipeVersionId"
        from catalog.recipes r
        join catalog.recipe_versions rv on rv.recipe_id = r.id and rv.is_current
        where r.kind = 'dish' and r.product_id = ${refs.productId}
        limit 1
      `)
    ).rows[0] as { recipeId: string; recipeVersionId: string } | undefined;

    if (!recipe) {
      const recipeResult = await tx.execute(sql`
        insert into catalog.recipes (kind, product_id)
        values ('dish', ${refs.productId})
        returning id
      `);
      const recipeId = (recipeResult.rows[0] as { id: string }).id;
      const versionResult = await tx.execute(sql`
        insert into catalog.recipe_versions
          (recipe_id, version, base_output_qty, is_current, published_by, published_at)
        values (${recipeId}, 1, '1.000', true, ${publishedBy}, now() - interval '2 days')
        returning id
      `);
      const recipeVersionId = (versionResult.rows[0] as { id: string }).id;
      await tx.execute(sql`
        insert into catalog.recipe_lines (recipe_version_id, presentation_id, quantity)
        values (${recipeVersionId}, ${refs.chorizoPresentationId}, '2.000'),
               (${recipeVersionId}, ${refs.rellenaUnitId}, '1.000')
      `);
      recipe = { recipeId, recipeVersionId };
    }

    const existingShift = await tx.execute(sql`
      select id from pos.shifts
      where cashier_user_id = ${refs.cashierId} and status = 'closed_with_variance'
      limit 1
    `);
    if (existingShift.rows.length > 0) return;

    const shiftResult = await tx.execute(sql`
      insert into pos.shifts
        (site_id, cashier_user_id, status, opening_cash, opened_at, closed_at,
         cash_expected, cash_counted, cash_difference, closing_note)
      values
        (${refs.siteId}, ${refs.cashierId}, 'closed_with_variance', '100000.00',
         now() - interval '1 day', now() - interval '1 hour',
         '130000.00', '125000.00', '-5000.00',
         'Faltante de $5.000 en efectivo; se revisa con el supervisor.')
      returning id
    `);
    const shiftId = (shiftResult.rows[0] as { id: string }).id;

    const saleResult = await tx.execute(sql`
      insert into pos.sales
        (number, shift_id, site_id, cashier_user_id, status, total, paid_total, change_amount, sold_at)
      values
        ('V-0001', ${shiftId}, ${refs.siteId}, ${refs.cashierId}, 'completed',
         '45000.00', '45000.00', '0.00', now() - interval '1 day' + interval '30 minutes')
      returning id
    `);
    const saleId = (saleResult.rows[0] as { id: string }).id;

    const lineResult = await tx.execute(sql`
      insert into pos.sale_lines
        (sale_id, line_no, product_id, presentation_id, quantity, unit_price, line_total,
         product_kind, recipe_version_id)
      values
        (${saleId}, 1, ${refs.productId}, ${refs.presentationId}, '1.000',
         ${refs.price}, ${refs.price}, 'prepared', ${recipe.recipeVersionId})
      returning id
    `);
    const saleLineId = (lineResult.rows[0] as { id: string }).id;

    await tx.execute(sql`
      insert into pos.sale_line_consumptions (sale_line_id, raw_material_id, presentation_id, quantity)
      values
        (${saleLineId}, null, ${refs.chorizoPresentationId}, '2.000'),
        (${saleLineId}, null, ${refs.rellenaUnitId}, '1.000')
    `);
    await tx.execute(sql`
      insert into pos.payments (sale_id, payment_method_id, amount)
      values
        (${saleId}, ${refs.cashMethodId}, '30000.00'),
        (${saleId}, ${refs.transferMethodId}, '15000.00')
    `);
    await tx.execute(sql`
      insert into pos.shift_counts
        (shift_id, payment_method_id, expected_amount, counted_amount, difference)
      values
        (${shiftId}, ${refs.cashMethodId}, '130000.00', '125000.00', '-5000.00'),
        (${shiftId}, ${refs.transferMethodId}, '15000.00', '15000.00', '0.00')
    `);
    await tx.execute(sql`
      insert into platform.document_sequences (doc_type, next_value)
      values ('V', 2)
      on conflict (doc_type) do update
        set next_value = greatest(platform.document_sequences.next_value, 2)
    `);
  });
}
