import {
  CreateTransferRequest,
  FefoAllocationRequest,
  ReceiveTransferRequest,
  TransferListQuery,
  type BaseUnit,
  type FefoAllocationResponse,
  type TransferDetail,
  type TransferPage,
  type TransferSummary,
} from '@quatreros/contracts';
import { Decimal } from 'decimal.js';
import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '../../../platform/audit/audit.js';
import type { Database } from '../../../platform/db/client.js';
import { documentSequences } from '../../../platform/db/schema/platform.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { AppError } from '../../../platform/http/errors.js';
import { authorize } from '../../admin/application/public.js';
import { recordMovement } from './movements.js';
import { siteIdsFor } from './access.js';
import { allocateFefo } from './fefo.js';
import { transferLines, transfers } from '../infrastructure/schema.js';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface TransferDeps {
  db: Database;
}

interface LocationInfo {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  kind: string;
  isActive: boolean;
}

interface TransferRow {
  id: string;
  number: string;
  fromLocationId: string;
  fromLocationName: string;
  fromSiteName: string;
  toLocationId: string;
  toLocationName: string;
  toSiteName: string;
  status: TransferSummary['status'];
  sentByName: string | null;
  sentAt: Date | string;
  receivedByName: string | null;
  receivedAt: Date | string | null;
  lineCount: number;
  totalSent: string;
}

interface TransferLineRow {
  id: string;
  lotId: string;
  lotCode: string;
  presentationId: string;
  presentationName: string;
  itemName: string;
  sentQuantity: string;
  receivedQuantity: string | null;
  expiresOn: string | null;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function siteFilter(siteIds: string[] | null, fromAlias = 'fs', toAlias = 'ts'): ReturnType<typeof sql> {
  if (siteIds === null) return sql`true`;
  if (siteIds.length === 0) return sql`false`;
  const list = sql.join(
    siteIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`(${sql.raw(fromAlias)}.id in (${list}) or ${sql.raw(toAlias)}.id in (${list}))`;
}

async function locationInfo(tx: Executor, id: string): Promise<LocationInfo | undefined> {
  const result = await tx.execute(sql`
    select l.id, l.name, l.kind, l.is_active as "isActive", s.id as "siteId", s.name as "siteName"
    from admin.locations l
    join admin.sites s on s.id = l.site_id
    where l.id = ${id}
    limit 1
  `);
  return (result.rows as unknown as LocationInfo[])[0];
}

async function transitLocationFor(tx: Executor, siteId: string): Promise<LocationInfo | undefined> {
  const result = await tx.execute(sql`
    select l.id, l.name, l.kind, l.is_active as "isActive", s.id as "siteId", s.name as "siteName"
    from admin.locations l
    join admin.sites s on s.id = l.site_id
    where l.site_id = ${siteId} and l.kind = 'in_transit' and l.is_active = true
    limit 1
  `);
  return (result.rows as unknown as LocationInfo[])[0];
}

async function nextNumber(tx: Executor): Promise<string> {
  await tx.insert(documentSequences).values({ docType: 'T' }).onConflictDoNothing();
  const [row] = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(eq(documentSequences.docType, 'T'))
    .returning({ nextValue: documentSequences.nextValue });
  const value = (row?.nextValue ?? 2) - 1;
  return `T-${String(value).padStart(4, '0')}`;
}

function toSummary(row: TransferRow): TransferSummary {
  return {
    id: row.id,
    number: row.number,
    fromLocationId: row.fromLocationId,
    fromLocationName: row.fromLocationName,
    fromSiteName: row.fromSiteName,
    toLocationId: row.toLocationId,
    toLocationName: row.toLocationName,
    toSiteName: row.toSiteName,
    status: row.status,
    sentByName: row.sentByName,
    sentAt: iso(row.sentAt) ?? new Date(0).toISOString(),
    receivedByName: row.receivedByName,
    receivedAt: iso(row.receivedAt),
    lineCount: row.lineCount,
    totalSent: row.totalSent,
  };
}

export async function simulateFefo(
  deps: TransferDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<FefoAllocationResponse> {
  authorize(ctx, 'inv.stock.read');
  const input = FefoAllocationRequest.parse(raw);
  const location = await locationInfo(deps.db, input.locationId);
  if (!location) throw AppError.notFound();
  authorize(ctx, 'inv.stock.read', { siteId: location.siteId });
  const result = await allocateFefo(deps.db, input, {
    lock: false,
    siteIds: siteIdsFor(ctx, 'inv.stock.read'),
  });
  return {
    data: {
      allocations: result.allocations,
      baseQuantity: result.baseQuantity,
      baseUnit: result.baseUnit as BaseUnit,
    },
  };
}

export async function listTransfers(
  deps: TransferDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<TransferPage> {
  const siteIds = siteIdsFor(ctx, 'inv.stock.read');
  const query = TransferListQuery.parse(raw);
  const conditions = [siteFilter(siteIds)];
  if (query.status) conditions.push(sql`t.status = ${query.status}`);
  if (query.from) conditions.push(sql`t.sent_at::date >= ${query.from}`);
  if (query.to) conditions.push(sql`t.sent_at::date <= ${query.to}`);

  const result = await deps.db.execute(sql`
    select t.id, t.number,
           t.from_location_id as "fromLocationId", fl.name as "fromLocationName", fs.name as "fromSiteName",
           t.to_location_id as "toLocationId", tl.name as "toLocationName", ts.name as "toSiteName",
           t.status,
           su.full_name as "sentByName", t.sent_at as "sentAt",
           ru.full_name as "receivedByName", t.received_at as "receivedAt",
           count(tl2.id)::int as "lineCount",
           round(coalesce(sum(tl2.sent_qty), 0), 3) as "totalSent"
    from inventory.transfers t
    join admin.locations fl on fl.id = t.from_location_id
    join admin.sites fs on fs.id = fl.site_id
    join admin.locations tl on tl.id = t.to_location_id
    join admin.sites ts on ts.id = tl.site_id
    left join admin.users su on su.id = t.sent_by
    left join admin.users ru on ru.id = t.received_by
    left join inventory.transfer_lines tl2 on tl2.transfer_id = t.id
    where ${sql.join(conditions, sql` and `)}
    group by t.id, fl.name, fs.name, tl.name, ts.name, su.full_name, ru.full_name
    order by t.sent_at desc, t.number desc
    limit ${query.limit}
  `);
  const rows = result.rows as unknown as TransferRow[];
  return { data: rows.map(toSummary), page: { nextCursor: null, limit: query.limit } };
}

export async function getTransfer(
  deps: TransferDeps,
  ctx: ExecutionContext,
  transferId: string,
): Promise<TransferDetail> {
  const siteIds = siteIdsFor(ctx, 'inv.stock.read');
  const result = await deps.db.execute(sql`
    select t.id, t.number,
           t.from_location_id as "fromLocationId", fl.name as "fromLocationName", fs.name as "fromSiteName",
           t.to_location_id as "toLocationId", tl.name as "toLocationName", ts.name as "toSiteName",
           t.status,
           su.full_name as "sentByName", t.sent_at as "sentAt",
           ru.full_name as "receivedByName", t.received_at as "receivedAt",
           count(tl2.id)::int as "lineCount",
           round(coalesce(sum(tl2.sent_qty), 0), 3) as "totalSent"
    from inventory.transfers t
    join admin.locations fl on fl.id = t.from_location_id
    join admin.sites fs on fs.id = fl.site_id
    join admin.locations tl on tl.id = t.to_location_id
    join admin.sites ts on ts.id = tl.site_id
    left join admin.users su on su.id = t.sent_by
    left join admin.users ru on ru.id = t.received_by
    left join inventory.transfer_lines tl2 on tl2.transfer_id = t.id
    where t.id = ${transferId} and ${siteFilter(siteIds)}
    group by t.id, fl.name, fs.name, tl.name, ts.name, su.full_name, ru.full_name
    limit 1
  `);
  const row = (result.rows as unknown as TransferRow[])[0];
  if (!row) throw AppError.notFound();

  const lines = await deps.db.execute(sql`
    select tl.id, tl.lot_id as "lotId", l.code as "lotCode",
           tl.presentation_id as "presentationId", pr.name as "presentationName",
           coalesce(p.name, rm.name) as "itemName",
           tl.sent_qty as "sentQuantity", tl.received_qty as "receivedQuantity",
           l.expires_on as "expiresOn"
    from inventory.transfer_lines tl
    join inventory.lots l on l.id = tl.lot_id
    left join catalog.presentations pr on pr.id = tl.presentation_id
    left join catalog.products p on p.id = l.product_id
    left join catalog.raw_materials rm on rm.id = l.raw_material_id
    where tl.transfer_id = ${transferId}
    order by l.code
  `);
  return {
    ...toSummary(row),
    lines: (lines.rows as unknown as TransferLineRow[]).map((line) => ({
      id: line.id,
      lotId: line.lotId,
      lotCode: line.lotCode,
      presentationId: line.presentationId,
      presentationName: line.presentationName,
      itemName: line.itemName,
      sentQuantity: line.sentQuantity,
      receivedQuantity: line.receivedQuantity,
      expiresOn: line.expiresOn,
    })),
  };
}

export async function createTransfer(
  deps: TransferDeps,
  ctx: ExecutionContext,
  raw: unknown,
): Promise<TransferDetail> {
  const actor = authorize(ctx, 'inv.transfer.create');
  const input = CreateTransferRequest.parse(raw);
  if (input.fromLocationId === input.toLocationId) {
    throw new AppError(
      422,
      'VALIDATION_FAILED',
      'Traslado inválido',
      'El origen y el destino deben ser distintos.',
    );
  }

  const transferId = await deps.db.transaction(async (tx) => {
    const from = await locationInfo(tx, input.fromLocationId);
    const to = await locationInfo(tx, input.toLocationId);
    if (!from || !to || !from.isActive || !to.isActive) throw AppError.notFound();
    if (from.kind === 'in_transit' || to.kind === 'in_transit') {
      throw new AppError(
        422,
        'VALIDATION_FAILED',
        'Traslado inválido',
        'No se puede enviar ni recibir directamente en una ubicación en tránsito.',
      );
    }
    authorize(ctx, 'inv.transfer.create', { siteId: from.siteId });
    authorize(ctx, 'inv.transfer.create', { siteId: to.siteId });

    const transit = await transitLocationFor(tx, from.siteId);
    if (!transit) {
      throw AppError.conflict(
        'NO_TRANSIT_LOCATION',
        'Falta la ubicación en tránsito',
        'La sede de origen no tiene una ubicación "En tránsito" activa.',
      );
    }

    const number = await nextNumber(tx);
    const [transfer] = await tx
      .insert(transfers)
      .values({
        number,
        fromLocationId: from.id,
        toLocationId: to.id,
        transitLocationId: transit.id,
        sentBy: actor.userId,
      })
      .returning({ id: transfers.id });
    if (!transfer) throw new Error('No se pudo crear el traslado');

    for (const line of input.lines) {
      const allocation = await allocateFefo(
        tx,
        {
          presentationId: line.presentationId,
          locationId: from.id,
          quantity: line.quantity,
        },
        { lock: true },
      );
      for (const item of allocation.allocations) {
        await tx.insert(transferLines).values({
          transferId: transfer.id,
          lotId: item.lotId,
          presentationId: line.presentationId,
          sentQty: item.quantity,
        });
        await recordMovement(tx, {
          movementType: 'transfer_out',
          lotId: item.lotId,
          presentationId: line.presentationId,
          locationId: from.id,
          quantity: `-${item.quantity}`,
          baseQuantity: `-${item.baseQuantity}`,
          sourceType: 'inventory.transfer',
          sourceId: transfer.id,
          createdBy: actor.userId,
          reason: `Traslado ${number}`,
        });
        await recordMovement(tx, {
          movementType: 'transfer_in',
          lotId: item.lotId,
          presentationId: line.presentationId,
          locationId: transit.id,
          quantity: item.quantity,
          baseQuantity: item.baseQuantity,
          sourceType: 'inventory.transfer',
          sourceId: transfer.id,
          createdBy: actor.userId,
          reason: `Traslado ${number} en tránsito`,
        });
      }
    }

    await recordAudit(tx, ctx, {
      action: 'inv.transfer.create',
      entityType: 'inventory.transfer',
      entityId: transfer.id,
      siteId: from.siteId,
      after: {
        number,
        fromLocationId: from.id,
        toLocationId: to.id,
        transitLocationId: transit.id,
        lines: input.lines,
      },
    });
    return transfer.id;
  });

  return getTransfer(deps, ctx, transferId);
}

export async function receiveTransfer(
  deps: TransferDeps,
  ctx: ExecutionContext,
  transferId: string,
  raw: unknown,
): Promise<TransferDetail> {
  const actor = authorize(ctx, 'inv.transfer.receive');
  const input = ReceiveTransferRequest.parse(raw);

  await deps.db.transaction(async (tx) => {
    const [transfer] = await tx.select().from(transfers).where(eq(transfers.id, transferId)).for('update');
    if (!transfer) throw AppError.notFound();
    if (transfer.status !== 'in_transit') {
      throw AppError.conflict(
        'TRANSFER_ALREADY_RECEIVED',
        'Traslado ya recibido',
        'Este traslado ya fue recibido y no se puede volver a confirmar.',
      );
    }

    const to = await locationInfo(tx, transfer.toLocationId);
    if (!to) throw AppError.notFound();
    authorize(ctx, 'inv.transfer.receive', { siteId: to.siteId });

    const lineResult = await tx.execute(sql`
      select tl.id, tl.lot_id as "lotId", tl.presentation_id as "presentationId",
             tl.sent_qty as "sentQty", tl.received_qty as "receivedQty",
             pr.units_per as "unitsPer"
      from inventory.transfer_lines tl
      join catalog.presentations pr on pr.id = tl.presentation_id
      where tl.transfer_id = ${transferId}
      order by tl.id
      for update of tl
    `);
    const lineRows = lineResult.rows as unknown as {
      id: string;
      lotId: string;
      presentationId: string;
      sentQty: string;
      receivedQty: string | null;
      unitsPer: string;
    }[];
    if (lineRows.length === 0) throw AppError.notFound();
    const byId = new Map(lineRows.map((line) => [line.id, line]));
    const seen = new Set<string>();

    for (const received of input.lines) {
      if (seen.has(received.lineId)) {
        throw new AppError(422, 'VALIDATION_FAILED', 'Recepción inválida', 'Una línea aparece dos veces.');
      }
      seen.add(received.lineId);
      const line = byId.get(received.lineId);
      if (!line) {
        throw new AppError(
          422,
          'VALIDATION_FAILED',
          'Recepción inválida',
          'La línea no pertenece al traslado.',
        );
      }
      if (new Decimal(received.receivedQuantity).gt(line.sentQty)) {
        throw new AppError(
          422,
          'VALIDATION_FAILED',
          'Recepción inválida',
          'La cantidad recibida no puede superar la enviada.',
        );
      }
    }

    for (const line of lineRows) {
      const received = input.lines.find((item) => item.lineId === line.id)?.receivedQuantity ?? '0';
      const amount = new Decimal(received);
      const baseAmount = amount.times(line.unitsPer);
      if (amount.gt(0)) {
        await recordMovement(tx, {
          movementType: 'transfer_out',
          lotId: line.lotId,
          presentationId: line.presentationId,
          locationId: transfer.transitLocationId,
          quantity: `-${amount.toFixed(3)}`,
          baseQuantity: `-${baseAmount.toFixed(3)}`,
          sourceType: 'inventory.transfer',
          sourceId: transfer.id,
          createdBy: actor.userId,
          reason: `Recepción ${transfer.number}`,
        });
        await recordMovement(tx, {
          movementType: 'transfer_in',
          lotId: line.lotId,
          presentationId: line.presentationId,
          locationId: to.id,
          quantity: amount.toFixed(3),
          baseQuantity: baseAmount.toFixed(3),
          sourceType: 'inventory.transfer',
          sourceId: transfer.id,
          createdBy: actor.userId,
          reason: `Recepción ${transfer.number}`,
        });
      }
      await tx
        .update(transferLines)
        .set({ receivedQty: amount.toFixed(3) })
        .where(eq(transferLines.id, line.id));
    }

    const complete = lineRows.every((line) => {
      const received = input.lines.find((item) => item.lineId === line.id)?.receivedQuantity ?? '0';
      return new Decimal(received).eq(line.sentQty);
    });

    await tx
      .update(transfers)
      .set({
        status: complete ? 'received' : 'received_with_variance',
        receivedBy: actor.userId,
        receivedAt: new Date(),
      })
      .where(eq(transfers.id, transferId));

    await recordAudit(tx, ctx, {
      action: 'inv.transfer.receive',
      entityType: 'inventory.transfer',
      entityId: transferId,
      siteId: to.siteId,
      after: {
        status: complete ? 'received' : 'received_with_variance',
        lines: input.lines,
      },
    });
  });

  return getTransfer(deps, ctx, transferId);
}
