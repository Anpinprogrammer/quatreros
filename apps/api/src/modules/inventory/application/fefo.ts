import { Decimal } from 'decimal.js';
import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { AppError } from '../../../platform/http/errors.js';

type Executor = Pick<Database, 'execute'>;

export interface FefoInput {
  presentationId: string;
  locationId: string;
  quantity: string;
}

export interface FefoAllocation {
  lotId: string;
  code: string;
  expiresOn: string | null;
  quantity: string;
  baseQuantity: string;
}

export interface FefoResult {
  allocations: FefoAllocation[];
  baseQuantity: string;
  baseUnit: string;
}

interface CandidateRow {
  lotId: string;
  code: string;
  expiresOn: string | null;
  quantity: string;
  unitsPer: string;
  baseUnit: string;
}

function siteFilter(siteIds: string[] | null | undefined): SQL {
  if (siteIds === null || siteIds === undefined) return sql``;
  if (siteIds.length === 0) return sql`and false`;
  return sql`and s.id in (${sql.join(
    siteIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

/**
 * FEFO (BR-083): lotes vendibles, no vencidos, con saldo, ordenados por vencimiento.
 * Reparte una cantidad entre lotes y falla si no alcanza. Con `lock` bloquea los saldos
 * en orden determinista para usarlo dentro de una transacción de salida.
 */
export async function allocateFefo(
  tx: Executor,
  input: FefoInput,
  options: { lock?: boolean; siteIds?: string[] | null } = {},
): Promise<FefoResult> {
  const lock = options.lock ? sql`for update of b` : sql``;
  const result = await tx.execute(sql`
    select b.lot_id as "lotId", l.code, l.expires_on as "expiresOn", b.quantity,
           pr.units_per as "unitsPer", p.base_unit as "baseUnit"
    from inventory.stock_balances b
    join inventory.lots l on l.id = b.lot_id
    join catalog.presentations pr on pr.id = b.presentation_id
    join catalog.products p on p.id = l.product_id
    join admin.locations loc on loc.id = b.location_id
    join admin.sites s on s.id = loc.site_id
    where b.presentation_id = ${input.presentationId}
      and b.location_id = ${input.locationId}
      and b.quantity > 0
      and l.status = 'available'
      and (l.expires_on is null or l.expires_on >= current_date)
      ${siteFilter(options.siteIds)}
    order by l.expires_on nulls last, l.created_at, l.id
    ${lock}
  `);
  const rows = result.rows as unknown as CandidateRow[];
  if (rows.length === 0) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      'Existencia insuficiente',
      `No hay existencia vendible para la presentación en esa ubicación. Faltan ${input.quantity}.`,
      { missing: input.quantity },
    );
  }

  let remaining = new Decimal(input.quantity);
  const allocations: FefoAllocation[] = [];
  const baseUnit = rows[0]?.baseUnit ?? 'unidad';
  let baseTotal = new Decimal(0);

  for (const row of rows) {
    if (remaining.lte(0)) break;
    const available = new Decimal(row.quantity);
    const take = Decimal.min(available, remaining);
    if (take.lte(0)) continue;
    const base = take.times(row.unitsPer);
    allocations.push({
      lotId: row.lotId,
      code: row.code,
      expiresOn: row.expiresOn,
      quantity: take.toFixed(3),
      baseQuantity: base.toFixed(3),
    });
    remaining = remaining.minus(take);
    baseTotal = baseTotal.plus(base);
  }

  if (remaining.gt(0)) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      'Existencia insuficiente',
      `Faltan ${remaining.toFixed(3)} unidades para completar el movimiento.`,
      { missing: remaining.toFixed(3) },
    );
  }

  return { allocations, baseQuantity: baseTotal.toFixed(3), baseUnit };
}
