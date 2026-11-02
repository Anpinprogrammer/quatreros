import { sql } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';

type Executor = Pick<Database, 'execute'>;

export interface SalePresentation {
  presentationId: string;
  presentationName: string;
  productId: string;
  productName: string;
  kind: 'manufactured' | 'prepared';
  unitsPer: string;
  price: string;
  presentationActive: boolean;
  productActive: boolean;
}

/** Presentación vendible con su precio vigente, para congelar el precio del pedido (RF-151). */
export async function loadSalePresentation(
  db: Executor,
  presentationId: string,
): Promise<SalePresentation | undefined> {
  const result = await db.execute(sql`
    select pr.id as "presentationId", pr.name as "presentationName",
           p.id as "productId", p.name as "productName", p.kind,
           pr.units_per as "unitsPer",
           ph.price, pr.is_active as "presentationActive", p.is_active as "productActive"
    from catalog.presentations pr
    join catalog.products p on p.id = pr.product_id
    join catalog.price_history ph on ph.presentation_id = pr.id and ph.valid_to is null
    where pr.id = ${presentationId}
    limit 1
  `);
  return (result.rows as unknown as SalePresentation[])[0];
}
