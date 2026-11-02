import {
  CloseShiftRequest,
  CreateDishRecipeRequest,
  CreateDishRecipeVersionRequest,
  CreateSaleRequest,
  DishRecipeListQuery,
  OpenShiftRequest,
  PosCatalogQuery,
  ReviewShiftRequest,
  ShiftListQuery,
  type DishRecipeDetail,
  type DishRecipePage,
  type DishRecipeSummary,
  type PaymentMethodView,
  type PosCatalog,
  type PosCatalogItem,
  type SaleDetail,
  type SaleLineView,
  type SaleSummary,
  type ShiftDetail,
  type ShiftPage,
  type ShiftStatus,
  type ShiftSummary,
} from '@quatreros/contracts';
import { Decimal } from 'decimal.js';
import { eq, sql, type SQL } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize, listFilter, requireActor } from '../../admin/application/public.js';
import {
  createDishRecipeRow,
  createDishRecipeVersionRow,
  getDishRecipe,
  listDishRecipes,
  loadCurrentDishRecipe,
  loadSalePresentation,
} from '../../catalog/application/public.js';
import { listActivePaymentMethods } from '../../finance/application/public.js';
import { issueForSale } from '../../inventory/application/public.js';
import {
  difference,
  expectedCash,
  lineTotal,
  paymentIssue,
  paymentTotals,
  salesTotal,
  shiftStatusFor,
  theoreticalQuantity,
} from '../domain/pos.js';
import {
  payments,
  saleLineConsumptions,
  saleLineLots,
  saleLines,
  sales,
  shiftCounts,
  shifts,
} from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface PosDeps {
  db: Database;
}

interface SiteRow {
  id: string;
  name: string;
}

interface LocationRow {
  id: string;
  name: string;
}

interface ShiftRow {
  id: string;
  siteId: string;
  siteName: string;
  cashierUserId: string;
  cashierName: string;
  status: ShiftStatus;
  openingCash: string;
  openedAt: Date | string;
  closedAt: Date | string | null;
  cashExpected: string | null;
  cashCounted: string | null;
  cashDifference: string | null;
  closingNote: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | string | null;
  reviewNote: string | null;
  saleCount: number;
  salesTotal: string;
}

interface ShiftLockRow {
  id: string;
  siteId: string;
  cashierUserId: string;
  status: ShiftStatus;
  openingCash: string;
}

interface SaleRow {
  id: string;
  number: string;
  shiftId: string;
  siteId: string;
  siteName: string;
  cashierUserId: string;
  cashierName: string;
  total: string;
  changeAmount: string;
  soldAt: Date | string;
  lineCount: number;
}

interface SaleLineRow {
  id: string;
  productId: string;
  productName: string;
  presentationId: string;
  presentationName: string;
  kind: 'manufactured' | 'prepared';
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  recipeVersion: number | null;
}

interface LotRow {
  saleLineId: string;
  lotId: string;
  lotCode: string;
  quantity: string;
}

interface ConsumptionRow {
  saleLineId: string;
  rawMaterialId: string | null;
  presentationId: string | null;
  rawMaterialName: string | null;
  rawMaterialUnit: string | null;
  productName: string | null;
  presentationName: string | null;
  quantity: string;
}

interface PaymentRow {
  paymentMethodId: string;
  paymentMethodName: string;
  isCash: boolean;
  amount: string;
}

interface CountRow {
  paymentMethodId: string;
  paymentMethodName: string;
  isCash: boolean;
  expectedAmount: string;
  countedAmount: string;
  difference: string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function money(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Decimal(String(value)).toFixed(2);
}

function validation(detail: string): AppError {
  return new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', detail);
}

function isUniqueViolation(err: unknown): boolean {
  const direct = (err as { code?: string }).code;
  const cause = (err as { cause?: { code?: string } }).cause?.code;
  return direct === '23505' || cause === '23505';
}

function siteCondition(siteIds: string[] | null, alias = 'site'): SQL {
  if (siteIds === null) return sql`true`;
  if (siteIds.length === 0) return sql`false`;
  return sql`${sql.raw(alias)}.id in (${sql.join(
    siteIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

function scopeSiteIds(ctx: ExecutionContext, permission: string): string[] | null {
  const filter = listFilter(ctx, permission);
  if (filter.kind === 'all') return null;
  return filter.siteIds;
}

async function nextNumber(tx: Executor, docType: string, prefix: string): Promise<string> {
  await tx.insert(documentSequences).values({ docType }).onConflictDoNothing();
  const [row] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, docType))
    .returning({ nextValue: documentSequences.nextValue });
  const value = (row?.nextValue ?? 2) - 1;
  return `${prefix}-${String(value).padStart(4, '0')}`;
}

/** Resuelve el sitio POS del alcance; si no se indica, usa el primero del cajero. */
async function resolvePosSite(db: Executor, ctx: ExecutionContext, siteId?: string): Promise<SiteRow> {
  const actor = requireActor(ctx);
  const result = siteId
    ? await db.execute(sql`
        select id, name from admin.sites where id = ${siteId} and kind = 'point_of_sale' and is_active = true
      `)
    : await db.execute(sql`
        select id, name from admin.sites where kind = 'point_of_sale' and is_active = true order by name
      `);
  const rows = result.rows as unknown as SiteRow[];
  const site = rows.find((row) => actor.siteIds.includes(row.id));
  if (!site) {
    throw new AppError(
      404,
      'SITE_NOT_ALLOWED',
      'Sede no disponible',
      'No hay un punto de venta activo en tu alcance.',
    );
  }
  return site;
}

async function posGoodsLocation(db: Executor, siteId: string): Promise<LocationRow> {
  const result = await db.execute(sql`
    select id, name from admin.locations
    where site_id = ${siteId} and kind = 'pos_goods' and is_active = true
    limit 1
  `);
  const row = (result.rows as unknown as LocationRow[])[0];
  if (!row) {
    throw AppError.conflict(
      'POS_LOCATION_MISSING',
      'Punto de venta sin ubicación',
      'La sede no tiene una ubicación activa de productos del punto.',
    );
  }
  return row;
}

function toShiftSummary(row: ShiftRow): ShiftSummary {
  return {
    id: row.id,
    siteId: row.siteId,
    siteName: row.siteName,
    cashierUserId: row.cashierUserId,
    cashierName: row.cashierName,
    status: row.status,
    openingCash: money(row.openingCash) ?? '0.00',
    openedAt: iso(row.openedAt),
    closedAt: row.closedAt ? iso(row.closedAt) : null,
    cashExpected: money(row.cashExpected),
    cashCounted: money(row.cashCounted),
    cashDifference: money(row.cashDifference),
    closingNote: row.closingNote,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null,
    reviewNote: row.reviewNote,
    saleCount: row.saleCount,
    salesTotal: money(row.salesTotal) ?? '0.00',
  };
}

async function shiftRow(deps: { db: Executor }, id: string, lock = false): Promise<ShiftRow | undefined> {
  const result = await deps.db.execute(sql`
    select s.id, s.site_id as "siteId", site.name as "siteName",
           s.cashier_user_id as "cashierUserId", u.full_name as "cashierName",
           s.status, s.opening_cash as "openingCash", s.opened_at as "openedAt",
           s.closed_at as "closedAt", s.cash_expected as "cashExpected",
           s.cash_counted as "cashCounted", s.cash_difference as "cashDifference",
           s.closing_note as "closingNote", ru.full_name as "reviewedByName",
           s.reviewed_at as "reviewedAt", s.review_note as "reviewNote",
           (select count(*)::int from pos.sales sa where sa.shift_id = s.id) as "saleCount",
           coalesce((select sum(sa.total) from pos.sales sa where sa.shift_id = s.id), 0) as "salesTotal"
    from pos.shifts s
    join admin.sites site on site.id = s.site_id
    join admin.users u on u.id = s.cashier_user_id
    left join admin.users ru on ru.id = s.reviewed_by
    where s.id = ${id}
    ${lock ? sql`for update of s` : sql``}
  `);
  return (result.rows as unknown as ShiftRow[])[0];
}

async function lockShift(db: Executor, id: string): Promise<ShiftLockRow | undefined> {
  const result = await db.execute(sql`
    select id, site_id as "siteId", cashier_user_id as "cashierUserId", status,
           opening_cash as "openingCash"
    from pos.shifts where id = ${id} for update
  `);
  return (result.rows as unknown as ShiftLockRow[])[0];
}

function saleSummary(row: SaleRow): SaleSummary {
  return {
    id: row.id,
    number: row.number,
    total: money(row.total) ?? '0.00',
    changeAmount: money(row.changeAmount) ?? '0.00',
    soldAt: iso(row.soldAt),
    lineCount: row.lineCount,
  };
}

async function saleSummaryRows(db: Executor, shiftId: string): Promise<SaleSummary[]> {
  const result = await db.execute(sql`
    select sa.id, sa.number, sa.total, sa.change_amount as "changeAmount", sa.sold_at as "soldAt",
           (select count(*)::int from pos.sale_lines sl where sl.sale_id = sa.id) as "lineCount"
    from pos.sales sa where sa.shift_id = ${shiftId}
    order by sa.sold_at asc, sa.number asc
  `);
  return (result.rows as unknown as SaleRow[]).map(saleSummary);
}

async function countRows(db: Executor, shiftId: string): Promise<CountRow[]> {
  const result = await db.execute(sql`
    select sc.payment_method_id as "paymentMethodId", pm.name as "paymentMethodName",
           pm.is_cash as "isCash", sc.expected_amount as "expectedAmount",
           sc.counted_amount as "countedAmount", sc.difference
    from pos.shift_counts sc
    join finance.payment_methods pm on pm.id = sc.payment_method_id
    where sc.shift_id = ${shiftId}
    order by pm.is_cash desc, pm.name
  `);
  return result.rows as unknown as CountRow[];
}

async function shiftDetail(deps: PosDeps, id: string): Promise<ShiftDetail | undefined> {
  const row = await shiftRow(deps, id);
  if (!row) return undefined;
  return {
    ...toShiftSummary(row),
    counts: (await countRows(deps.db, id)).map((count) => ({
      paymentMethodId: count.paymentMethodId,
      paymentMethodName: count.paymentMethodName,
      isCash: count.isCash,
      expectedAmount: money(count.expectedAmount) ?? '0.00',
      countedAmount: money(count.countedAmount) ?? '0.00',
      difference: money(count.difference) ?? '0.00',
    })),
    sales: await saleSummaryRows(deps.db, id),
  };
}

async function saleDetailRows(db: Executor, saleId: string): Promise<SaleDetail | undefined> {
  const result = await db.execute(sql`
    select sa.id, sa.number, sa.shift_id as "shiftId", sa.site_id as "siteId",
           site.name as "siteName", sa.cashier_user_id as "cashierUserId",
           u.full_name as "cashierName", sa.total,
           sa.change_amount as "changeAmount", sa.sold_at as "soldAt",
           (select count(*)::int from pos.sale_lines sl where sl.sale_id = sa.id) as "lineCount"
    from pos.sales sa
    join admin.sites site on site.id = sa.site_id
    join admin.users u on u.id = sa.cashier_user_id
    where sa.id = ${saleId}
  `);
  const row = (result.rows as unknown as SaleRow[])[0];
  if (!row) return undefined;

  const lineResult = await db.execute(sql`
    select sl.id, sl.product_id as "productId", p.name as "productName",
           sl.presentation_id as "presentationId", pr.name as "presentationName",
           sl.product_kind as "kind", sl.quantity, sl.unit_price as "unitPrice",
           sl.line_total as "lineTotal", rv.version as "recipeVersion"
    from pos.sale_lines sl
    join catalog.products p on p.id = sl.product_id
    join catalog.presentations pr on pr.id = sl.presentation_id
    left join catalog.recipe_versions rv on rv.id = sl.recipe_version_id
    where sl.sale_id = ${saleId}
    order by sl.line_no
  `);
  const lines = lineResult.rows as unknown as SaleLineRow[];

  const lotsResult = await db.execute(sql`
    select sll.sale_line_id as "saleLineId", sll.lot_id as "lotId", l.code as "lotCode", sll.quantity
    from pos.sale_line_lots sll
    join inventory.lots l on l.id = sll.lot_id
    where sll.sale_line_id in (${sql.join(
      lines.map((line) => sql`${line.id}`),
      sql`, `,
    )})
    order by l.code
  `);
  const lots = lotsResult.rows as unknown as LotRow[];

  const consumptionResult = await db.execute(sql`
    select slc.sale_line_id as "saleLineId", slc.raw_material_id as "rawMaterialId",
           slc.presentation_id as "presentationId", rm.name as "rawMaterialName",
           rm.unit as "rawMaterialUnit", p.name as "productName", pr.name as "presentationName",
           slc.quantity
    from pos.sale_line_consumptions slc
    left join catalog.raw_materials rm on rm.id = slc.raw_material_id
    left join catalog.presentations pr on pr.id = slc.presentation_id
    left join catalog.products p on p.id = pr.product_id
    where slc.sale_line_id in (${sql.join(
      lines.map((line) => sql`${line.id}`),
      sql`, `,
    )})
    order by coalesce(rm.name, p.name) asc
  `);
  const consumptions = consumptionResult.rows as unknown as ConsumptionRow[];

  const paymentResult = await db.execute(sql`
    select pay.payment_method_id as "paymentMethodId", pm.name as "paymentMethodName",
           pm.is_cash as "isCash", pay.amount
    from pos.payments pay
    join finance.payment_methods pm on pm.id = pay.payment_method_id
    where pay.sale_id = ${saleId}
    order by pm.name
  `);
  const paymentsRows = paymentResult.rows as unknown as PaymentRow[];

  return {
    ...saleSummary(row),
    shiftId: row.shiftId,
    siteId: row.siteId,
    siteName: row.siteName,
    cashierUserId: row.cashierUserId,
    cashierName: row.cashierName,
    lines: lines.map((line): SaleLineView => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      presentationId: line.presentationId,
      presentationName: line.presentationName,
      kind: line.kind,
      quantity: line.quantity,
      unitPrice: money(line.unitPrice) ?? '0.00',
      lineTotal: money(line.lineTotal) ?? '0.00',
      recipeVersion: line.recipeVersion,
      lots: lots
        .filter((lot) => lot.saleLineId === line.id)
        .map((lot) => ({ lotId: lot.lotId, lotCode: lot.lotCode, quantity: lot.quantity })),
      consumption: consumptions
        .filter((consumption) => consumption.saleLineId === line.id)
        .map((consumption) => ({
          name: consumption.rawMaterialId
            ? (consumption.rawMaterialName ?? 'Materia prima')
            : `${consumption.productName ?? 'Producto'} · ${consumption.presentationName ?? 'Presentación'}`,
          unit: consumption.rawMaterialId ? (consumption.rawMaterialUnit ?? 'unidad') : 'presentación',
          quantity: consumption.quantity,
        })),
    })),
    payments: paymentsRows.map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      paymentMethodName: payment.paymentMethodName,
      isCash: payment.isCash,
      amount: money(payment.amount) ?? '0.00',
    })),
  };
}

function paymentMethodView(method: { id: string; name: string; isCash: boolean }): PaymentMethodView {
  return { id: method.id, name: method.name, isCash: method.isCash };
}

export async function listPosCatalog(
  deps: PosDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<PosCatalog> {
  authorize(ctx, 'pos.sale.create');
  const query = PosCatalogQuery.parse(raw);
  const site = await resolvePosSite(deps.db, ctx, query.siteId);
  const location = await posGoodsLocation(deps.db, site.id);

  const itemResult = await deps.db.execute(sql`
    select p.id as "productId", p.name as "productName", p.kind,
           pr.id as "presentationId", pr.name as "presentationName",
           pr.units_per as "unitsPer", ph.price
    from catalog.presentations pr
    join catalog.products p on p.id = pr.product_id
    join catalog.price_history ph on ph.presentation_id = pr.id and ph.valid_to is null
    where p.is_active = true and pr.is_active = true
    order by p.name, pr.name
  `);
  const rows = itemResult.rows as unknown as {
    productId: string;
    productName: string;
    kind: 'manufactured' | 'prepared';
    presentationId: string;
    presentationName: string;
    unitsPer: string;
    price: string;
  }[];

  const stockResult = await deps.db.execute(sql`
    select presentation_id as "presentationId", coalesce(sum(quantity), 0) as quantity
    from inventory.stock_balances
    where location_id = ${location.id} and quantity > 0
    group by presentation_id
  `);
  const stock = new Map(
    (stockResult.rows as unknown as { presentationId: string; quantity: string }[]).map((row) => [
      row.presentationId,
      new Decimal(row.quantity),
    ]),
  );

  const recipeResult = await deps.db.execute(sql`
    select r.product_id as "productId", rv.id as "recipeVersionId"
    from catalog.recipes r
    join catalog.recipe_versions rv on rv.recipe_id = r.id and rv.is_current
    where r.kind = 'dish'
  `);
  const recipes = new Map(
    (recipeResult.rows as unknown as { productId: string; recipeVersionId: string }[]).map((row) => [
      row.productId,
      row.recipeVersionId,
    ]),
  );

  const items: PosCatalogItem[] = rows.map((row) => {
    const recipeVersionId = recipes.get(row.productId) ?? null;
    const available = row.kind === 'manufactured' ? (stock.get(row.presentationId) ?? new Decimal(0)) : null;
    const hasStock = available === null || available.gt(0);
    const hasRecipe = row.kind === 'manufactured' || recipeVersionId !== null;
    const sellable = hasStock && hasRecipe;
    const reason = !hasStock
      ? 'Sin existencia en el punto de venta'
      : !hasRecipe
        ? 'Sin receta de plato vigente'
        : null;
    return {
      productId: row.productId,
      productName: row.productName,
      presentationId: row.presentationId,
      presentationName: row.presentationName,
      unitsPer: row.unitsPer,
      kind: row.kind,
      price: money(row.price) ?? '0.00',
      available: available === null ? null : available.toFixed(3),
      recipeVersionId,
      sellable,
      reason,
    };
  });

  return {
    siteId: site.id,
    siteName: site.name,
    items,
    paymentMethods: (await listActivePaymentMethods(deps.db)).map(paymentMethodView),
  };
}

export async function getCurrentShift(
  deps: PosDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<ShiftSummary | null> {
  const actor = authorize(ctx, 'pos.shift.open');
  const query = PosCatalogQuery.parse(raw);
  const site = await resolvePosSite(deps.db, ctx, query.siteId);
  const result = await deps.db.execute(sql`
    select id from pos.shifts
    where cashier_user_id = ${actor.userId} and site_id = ${site.id} and status = 'open'
    limit 1
  `);
  const row = (result.rows as unknown as { id: string }[])[0];
  if (!row) return null;
  return shiftDetail(deps, row.id).then((detail) => {
    if (!detail) return null;
    const { counts: _counts, sales: _sales, ...summary } = detail;
    return summary;
  });
}

export async function openShift(deps: PosDeps, ctx: ExecutionContext, raw: unknown): Promise<ShiftSummary> {
  const input = OpenShiftRequest.parse(raw);
  const actor = authorize(ctx, 'pos.shift.open', { siteId: input.siteId });
  const site = await resolvePosSite(deps.db, ctx, input.siteId);

  const id = await deps.db.transaction(async (tx) => {
    let shiftId: string;
    try {
      const [row] = await tx
        .insert(shifts)
        .values({
          siteId: site.id,
          cashierUserId: actor.userId,
          openingCash: input.openingCash,
        })
        .returning({ id: shifts.id });
      if (!row) throw new Error('No se pudo abrir el turno');
      shiftId = row.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw AppError.conflict(
          'SHIFT_ALREADY_OPEN',
          'Ya hay un turno abierto',
          'El cajero o la caja ya tienen un turno abierto. Ciérralo antes de abrir otro.',
        );
      }
      throw err;
    }
    await recordAudit(tx, ctx, {
      action: 'pos.shift.open',
      entityType: 'pos.shift',
      entityId: shiftId,
      siteId: site.id,
      after: { openingCash: input.openingCash },
    });
    return shiftId;
  });

  const detail = await shiftDetail(deps, id);
  if (!detail) throw new Error('No se pudo leer el turno recién abierto');
  const { counts: _counts, sales: _sales, ...summary } = detail;
  return summary;
}

export async function closeShift(
  deps: PosDeps,
  ctx: ExecutionContext,
  id: string,
  raw: unknown,
): Promise<ShiftDetail> {
  const input = CloseShiftRequest.parse(raw);
  const actor = authorize(ctx, 'pos.shift.close');

  await deps.db.transaction(async (tx) => {
    const shift = await lockShift(tx, id);
    if (!shift) throw AppError.notFound();
    if (shift.cashierUserId !== actor.userId) {
      throw AppError.forbidden('Solo el cajero del turno puede cerrarlo.');
    }
    authorize(ctx, 'pos.shift.close', { siteId: shift.siteId, ownerId: actor.userId });
    if (shift.status !== 'open') {
      throw AppError.conflict('SHIFT_NOT_OPEN', 'Turno no abierto', 'El turno ya fue cerrado.');
    }

    const methodIds = new Set<string>();
    for (const count of input.counts) {
      if (methodIds.has(count.paymentMethodId)) {
        throw validation('Cada medio de pago debe aparecer una sola vez en el conteo.');
      }
      methodIds.add(count.paymentMethodId);
    }

    const methods = await listActivePaymentMethods(tx);
    if (methods.length === 0) {
      throw AppError.conflict('PAYMENT_METHOD_INVALID', 'Sin medios de pago', 'No hay medios activos.');
    }
    const countByMethod = new Map(input.counts.map((count) => [count.paymentMethodId, count.countedAmount]));
    for (const method of methods) {
      if (!countByMethod.has(method.id)) {
        throw validation(`Falta el conteo de ${method.name}.`);
      }
    }

    const methodTotalsResult = await tx.execute(sql`
      select p.payment_method_id as "paymentMethodId", coalesce(sum(p.amount), 0) as amount
      from pos.payments p
      join pos.sales s on s.id = p.sale_id
      where s.shift_id = ${id}
      group by p.payment_method_id
    `);
    const methodTotals = new Map(
      (methodTotalsResult.rows as unknown as { paymentMethodId: string; amount: string }[]).map((row) => [
        row.paymentMethodId,
        row.amount,
      ]),
    );
    const changeResult = await tx.execute(sql`
      select coalesce(sum(change_amount), 0) as "changeTotal"
      from pos.sales where shift_id = ${id}
    `);
    const changeTotal = (changeResult.rows[0] as { changeTotal: string } | undefined)?.changeTotal ?? '0.00';
    const cashMethod = methods.find((method) => method.isCash);
    if (!cashMethod) {
      throw AppError.conflict(
        'PAYMENT_METHOD_INVALID',
        'Sin efectivo',
        'No hay un medio de pago en efectivo.',
      );
    }
    const cashPayments = methodTotals.get(cashMethod.id) ?? '0.00';
    const cashExpected = expectedCash(shift.openingCash, cashPayments, changeTotal);

    const counts = methods.map((method) => {
      const expected = method.isCash ? cashExpected : (methodTotals.get(method.id) ?? '0.00');
      const counted = countByMethod.get(method.id) ?? '0.00';
      return {
        paymentMethodId: method.id,
        expectedAmount: expected,
        countedAmount: counted,
        difference: difference(counted, expected),
      };
    });
    const cashCount = counts.find((count) => count.paymentMethodId === cashMethod.id);
    if (!cashCount) throw new Error('No se pudo calcular el conteo de efectivo');
    const cashDifference = cashCount.difference;
    const status = shiftStatusFor(cashDifference);
    if (status === 'closed_with_variance' && !input.note?.trim()) {
      throw new AppError(
        422,
        'VARIANCE_NOTE_REQUIRED',
        'Justificación requerida',
        'Explica la diferencia de efectivo antes de cerrar el turno.',
      );
    }

    await tx.insert(shiftCounts).values(
      counts.map((count) => ({
        shiftId: id,
        paymentMethodId: count.paymentMethodId,
        expectedAmount: count.expectedAmount,
        countedAmount: count.countedAmount,
        difference: count.difference,
      })),
    );
    await tx
      .update(shifts)
      .set({
        status,
        closedAt: new Date(),
        cashExpected,
        cashCounted: cashCount.countedAmount,
        cashDifference,
        closingNote: input.note?.trim() || null,
      })
      .where(eq(shifts.id, id));
    await recordAudit(tx, ctx, {
      action: 'pos.shift.close',
      entityType: 'pos.shift',
      entityId: id,
      siteId: shift.siteId,
      after: { status, cashExpected, cashCounted: cashCount.countedAmount, cashDifference, note: input.note },
    });
  });

  const detail = await shiftDetail(deps, id);
  if (!detail) throw new Error('No se pudo leer el turno cerrado');
  return detail;
}

export async function reviewShift(
  deps: PosDeps,
  ctx: ExecutionContext,
  id: string,
  raw: unknown,
): Promise<ShiftDetail> {
  const input = ReviewShiftRequest.parse(raw);
  const actor = authorize(ctx, 'pos.cash_variance.review');

  await deps.db.transaction(async (tx) => {
    const shift = await lockShift(tx, id);
    if (!shift) throw AppError.notFound();
    authorize(ctx, 'pos.cash_variance.review', { siteId: shift.siteId });
    if (shift.cashierUserId === actor.userId) {
      throw new AppError(
        403,
        'SELF_REVIEW_FORBIDDEN',
        'No puedes revisar tu propio turno',
        'La revisión debe hacerla un supervisor distinto del cajero.',
      );
    }
    if (shift.status === 'reviewed') {
      throw AppError.conflict('SHIFT_ALREADY_REVIEWED', 'Turno ya revisado', 'Este turno ya tiene revisión.');
    }
    if (shift.status !== 'closed_with_variance') {
      throw AppError.conflict(
        'SHIFT_NOT_IN_VARIANCE',
        'Turno sin diferencia',
        'Solo se revisan turnos cerrados con diferencia.',
      );
    }
    await tx
      .update(shifts)
      .set({
        status: 'reviewed',
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        reviewNote: input.conclusion,
      })
      .where(eq(shifts.id, id));
    await recordAudit(tx, ctx, {
      action: 'pos.shift.review',
      entityType: 'pos.shift',
      entityId: id,
      siteId: shift.siteId,
      after: { conclusion: input.conclusion },
    });
  });

  const detail = await shiftDetail(deps, id);
  if (!detail) throw new Error('No se pudo leer el turno revisado');
  return detail;
}

export async function listShifts(deps: PosDeps, ctx: ExecutionContext, raw: unknown): Promise<ShiftPage> {
  const query = ShiftListQuery.parse(raw);
  const siteIds = scopeSiteIds(ctx, 'pos.cash_variance.review');
  const status = query.status ?? 'closed_with_variance';
  const result = await deps.db.execute(sql`
    select s.id, s.site_id as "siteId", site.name as "siteName",
           s.cashier_user_id as "cashierUserId", u.full_name as "cashierName",
           s.status, s.opening_cash as "openingCash", s.opened_at as "openedAt",
           s.closed_at as "closedAt", s.cash_expected as "cashExpected",
           s.cash_counted as "cashCounted", s.cash_difference as "cashDifference",
           s.closing_note as "closingNote", ru.full_name as "reviewedByName",
           s.reviewed_at as "reviewedAt", s.review_note as "reviewNote",
           (select count(*)::int from pos.sales sa where sa.shift_id = s.id) as "saleCount",
           coalesce((select sum(sa.total) from pos.sales sa where sa.shift_id = s.id), 0) as "salesTotal"
    from pos.shifts s
    join admin.sites site on site.id = s.site_id
    join admin.users u on u.id = s.cashier_user_id
    left join admin.users ru on ru.id = s.reviewed_by
    where s.status = ${status} and ${siteCondition(siteIds)}
    order by s.opened_at desc, s.id desc
    limit ${query.limit}
  `);
  return {
    data: (result.rows as unknown as ShiftRow[]).map(toShiftSummary),
    page: { nextCursor: null, limit: query.limit },
  };
}

export async function getShift(deps: PosDeps, ctx: ExecutionContext, id: string): Promise<ShiftDetail> {
  const row = await shiftRow(deps, id);
  if (!row) throw AppError.notFound();
  const actor = requireActor(ctx);
  if (actor.userId === row.cashierUserId) {
    authorize(ctx, 'pos.shift.close', { siteId: row.siteId, ownerId: actor.userId });
  } else {
    authorize(ctx, 'pos.cash_variance.review', { siteId: row.siteId });
  }
  const detail = await shiftDetail(deps, id);
  if (!detail) throw AppError.notFound();
  return detail;
}

export async function createSale(deps: PosDeps, ctx: ExecutionContext, raw: unknown): Promise<SaleDetail> {
  const input = CreateSaleRequest.parse(raw);
  const actor = authorize(ctx, 'pos.sale.create');
  let saleId = '';

  await deps.db.transaction(async (tx) => {
    const shift = await lockShift(tx, input.shiftId);
    if (!shift) throw AppError.notFound();
    if (shift.cashierUserId !== actor.userId) {
      throw AppError.forbidden('Solo el cajero del turno puede vender.');
    }
    authorize(ctx, 'pos.sale.create', { siteId: shift.siteId, ownerId: actor.userId });
    if (shift.status !== 'open') {
      throw AppError.conflict('SHIFT_NOT_OPEN', 'Turno no abierto', 'Abre un turno antes de vender.');
    }
    const location = await posGoodsLocation(tx, shift.siteId);

    const lines: {
      presentation: NonNullable<Awaited<ReturnType<typeof loadSalePresentation>>>;
      quantity: string;
      total: string;
    }[] = [];
    for (const line of input.lines) {
      const presentation = await loadSalePresentation(tx, line.presentationId);
      if (!presentation || !presentation.presentationActive || !presentation.productActive) {
        throw new AppError(
          409,
          'PRICE_REQUIRED',
          'Presentación no vendible',
          'La presentación no está activa o no tiene precio vigente.',
        );
      }
      lines.push({
        presentation,
        quantity: line.quantity,
        total: lineTotal(presentation.price, line.quantity),
      });
    }
    const total = salesTotal(lines.map((line) => line.total));
    if (new Decimal(total).lte(0)) {
      throw validation('La venta debe tener un total mayor que cero.');
    }

    const methods = await listActivePaymentMethods(tx);
    const methodById = new Map(methods.map((method) => [method.id, method]));
    const paymentInputs = input.payments.map((payment) => {
      const method = methodById.get(payment.paymentMethodId);
      if (!method) {
        throw new AppError(
          422,
          'PAYMENT_METHOD_INVALID',
          'Medio de pago inválido',
          'El medio de pago no existe o está inactivo.',
        );
      }
      if (new Decimal(payment.amount).lte(0)) {
        throw validation('Cada pago debe ser mayor que cero.');
      }
      return { amount: payment.amount, isCash: method.isCash };
    });
    const issue = paymentIssue(total, paymentInputs);
    if (issue === 'BELOW_TOTAL') {
      throw new AppError(
        422,
        'PAYMENT_SUM_BELOW_TOTAL',
        'Pagos incompletos',
        'La suma de los pagos es menor que el total de la venta.',
      );
    }
    if (issue === 'CHANGE_NOT_CASH') {
      throw new AppError(
        422,
        'CHANGE_REQUIRES_CASH',
        'Cambio inválido',
        'El cambio solo puede cubrirse con efectivo.',
      );
    }
    const totals = paymentTotals(total, paymentInputs);

    const number = await nextNumber(tx, 'V', 'V');
    const [sale] = await tx
      .insert(sales)
      .values({
        number,
        shiftId: shift.id,
        siteId: shift.siteId,
        cashierUserId: actor.userId,
        total,
        paidTotal: totals.paid,
        changeAmount: totals.change,
        soldAt: new Date(),
      })
      .returning({ id: sales.id });
    if (!sale) throw new Error('No se pudo crear la venta');
    saleId = sale.id;

    const inserted: {
      id: string;
      presentation: (typeof lines)[number]['presentation'];
      quantity: string;
      recipe?: Awaited<ReturnType<typeof loadCurrentDishRecipe>>;
    }[] = [];
    for (const [index, line] of lines.entries()) {
      const recipe =
        line.presentation.kind === 'prepared'
          ? await loadCurrentDishRecipe(tx, line.presentation.productId)
          : undefined;
      if (line.presentation.kind === 'prepared' && !recipe) {
        throw AppError.conflict(
          'RECIPE_REQUIRED',
          'Plato sin receta',
          'El plato no tiene una receta vigente; no se puede calcular su consumo teórico.',
        );
      }
      const [row] = await tx
        .insert(saleLines)
        .values({
          saleId: sale.id,
          lineNo: index + 1,
          productId: line.presentation.productId,
          presentationId: line.presentation.presentationId,
          quantity: line.quantity,
          unitPrice: line.presentation.price,
          lineTotal: line.total,
          productKind: line.presentation.kind,
          recipeVersionId: recipe?.recipeVersionId ?? null,
        })
        .returning({ id: saleLines.id });
      if (!row) throw new Error('No se pudo crear la línea de venta');
      inserted.push({ id: row.id, presentation: line.presentation, quantity: line.quantity, recipe });
    }

    for (const item of inserted) {
      if (item.presentation.kind === 'manufactured') {
        const allocations = await issueForSale(tx, {
          siteId: shift.siteId,
          locationId: location.id,
          presentationId: item.presentation.presentationId,
          quantity: item.quantity,
          saleId: sale.id,
          userId: actor.userId,
          reason: `Venta ${number}`,
        });
        await tx.insert(saleLineLots).values(
          allocations.map((allocation) => ({
            saleLineId: item.id,
            lotId: allocation.lotId,
            locationId: location.id,
            quantity: allocation.quantity,
          })),
        );
      } else {
        const recipe = item.recipe;
        if (!recipe) throw new Error('La línea preparada no tiene receta');
        const consumptions = recipe.lines.map((component) => ({
          saleLineId: item.id,
          rawMaterialId: component.rawMaterialId,
          presentationId: component.presentationId,
          quantity: theoreticalQuantity(component.quantity, recipe.baseOutputQty, item.quantity),
        }));
        if (consumptions.some((consumption) => new Decimal(consumption.quantity).lte(0))) {
          throw validation('El consumo teórico de la receta es menor a 0.001; revisa sus cantidades.');
        }
        await tx.insert(saleLineConsumptions).values(consumptions);
      }
    }

    await tx.insert(payments).values(
      input.payments.map((payment) => ({
        saleId: sale.id,
        paymentMethodId: payment.paymentMethodId,
        amount: payment.amount,
      })),
    );
    await recordAudit(tx, ctx, {
      action: 'pos.sale.create',
      entityType: 'pos.sale',
      entityId: sale.id,
      siteId: shift.siteId,
      after: { number, total, payments: input.payments, lines: input.lines },
    });
  });

  const detail = await saleDetailRows(deps.db, saleId);
  if (!detail) throw new Error('No se pudo leer la venta recién creada');
  return detail;
}

export async function getSale(deps: PosDeps, ctx: ExecutionContext, id: string): Promise<SaleDetail> {
  const detail = await saleDetailRows(deps.db, id);
  if (!detail) throw AppError.notFound();
  const actor = requireActor(ctx);
  if (detail.cashierUserId === actor.userId) {
    authorize(ctx, 'pos.sale.create', { siteId: detail.siteId, ownerId: actor.userId });
  } else {
    authorize(ctx, 'pos.cash_variance.review', { siteId: detail.siteId });
  }
  return detail;
}

export async function listDishRecipesEndpoint(
  deps: PosDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<DishRecipePage> {
  authorize(ctx, 'pos.dish_recipe.manage');
  const query = DishRecipeListQuery.parse(raw);
  const recipes = await listDishRecipes(deps.db, { q: query.q, limit: query.limit });
  const data: DishRecipeSummary[] = recipes.map((recipe) => ({
    id: recipe.id,
    productId: recipe.productId,
    productName: recipe.productName,
    currentVersion: recipe.currentVersion,
  }));
  return { data, page: { nextCursor: null, limit: query.limit } };
}

export async function getDishRecipeEndpoint(
  deps: PosDeps,
  ctx: ExecutionContext,
  id: string,
): Promise<DishRecipeDetail> {
  authorize(ctx, 'pos.dish_recipe.manage');
  const recipe = await getDishRecipe(deps.db, id);
  if (!recipe) throw AppError.notFound();
  return {
    id: recipe.id,
    productId: recipe.productId,
    productName: recipe.productName,
    currentVersion: recipe.currentVersion,
    versions: recipe.versions ?? [recipe.currentVersion],
  };
}

export async function createDishRecipe(
  deps: PosDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<DishRecipeDetail> {
  const input = CreateDishRecipeRequest.parse(raw);
  const actor = authorize(ctx, 'pos.dish_recipe.manage');
  const id = await deps.db.transaction(async (tx) => {
    const recipeId = await createDishRecipeRow(tx, { ...input }, actor.userId);
    await recordAudit(tx, ctx, {
      action: 'pos.dish_recipe.create',
      entityType: 'catalog.recipe',
      entityId: recipeId,
      after: input,
    });
    return recipeId;
  });
  return getDishRecipeEndpoint(deps, ctx, id);
}

export async function createDishRecipeVersion(
  deps: PosDeps,
  ctx: ExecutionContext,
  id: string,
  raw: unknown,
): Promise<DishRecipeDetail> {
  const input = CreateDishRecipeVersionRequest.parse(raw);
  const actor = authorize(ctx, 'pos.dish_recipe.manage');
  await deps.db.transaction(async (tx) => {
    await createDishRecipeVersionRow(tx, id, { ...input }, actor.userId);
    await recordAudit(tx, ctx, {
      action: 'pos.dish_recipe.version',
      entityType: 'catalog.recipe',
      entityId: id,
      after: input,
    });
  });
  return getDishRecipeEndpoint(deps, ctx, id);
}
