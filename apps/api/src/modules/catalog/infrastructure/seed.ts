import type { BaseUnit, ProductKind } from '@quatreros/contracts';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../../platform/db/client.js';
import { presentations, priceHistory, products, rawMaterials } from './schema.js';

/**
 * Catálogo de demostración (especificación cat/catalogo §9). Datos ficticios.
 * Idempotente: no duplica productos, presentaciones, precios ni materias primas.
 */

interface DemoPresentation {
  name: string;
  unitsPer: string;
  price: string;
  previousPrice?: { price: string; validFrom: string };
}

interface DemoProduct {
  name: string;
  kind: ProductKind;
  baseUnit: BaseUnit;
  shelfLifeDays: number | null;
  presentations: DemoPresentation[];
}

const CURRENT_FROM = '2026-10-01T00:00:00.000Z';

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: 'Chorizo Santarrosano',
    kind: 'manufactured',
    baseUnit: 'unidad',
    shelfLifeDays: 30,
    presentations: [
      {
        name: 'Unidad',
        unitsPer: '1.000',
        price: '1300.00',
        previousPrice: { price: '1200.00', validFrom: '2025-10-01T00:00:00.000Z' },
      },
      { name: 'Paquete x10', unitsPer: '10.000', price: '12000.00' },
    ],
  },
  {
    name: 'Rellena Mixta',
    kind: 'manufactured',
    baseUnit: 'unidad',
    shelfLifeDays: 30,
    presentations: [
      { name: 'Unidad', unitsPer: '1.000', price: '1200.00' },
      { name: 'Paquete x10', unitsPer: '10.000', price: '11000.00' },
    ],
  },
  {
    name: 'Picada Quatreros XL',
    kind: 'prepared',
    baseUnit: 'unidad',
    shelfLifeDays: null,
    presentations: [{ name: 'Porción', unitsPer: '1.000', price: '45000.00' }],
  },
];

export const DEMO_RAW_MATERIALS: { name: string; unit: BaseUnit; tracksExpiry: boolean }[] = [
  { name: 'Carne de cerdo magra', unit: 'kg', tracksExpiry: true },
  { name: 'Tocino y grasa', unit: 'kg', tracksExpiry: true },
  { name: 'Mix de especias', unit: 'kg', tracksExpiry: true },
  { name: 'Tripa natural', unit: 'm', tracksExpiry: true },
];

export async function seedDemoCatalog(db: Database, setByUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (const demo of DEMO_PRODUCTS) {
      const [inserted] = await tx
        .insert(products)
        .values({
          name: demo.name,
          kind: demo.kind,
          baseUnit: demo.baseUnit,
          shelfLifeDays: demo.shelfLifeDays,
        })
        .onConflictDoNothing({ target: products.name })
        .returning({ id: products.id });

      const productId =
        inserted?.id ??
        (await tx.select({ id: products.id }).from(products).where(eq(products.name, demo.name)).limit(1))[0]
          ?.id;
      if (!productId) throw new Error(`No se pudo sembrar el producto ${demo.name}`);

      for (const presentation of demo.presentations) {
        const [createdPresentation] = await tx
          .insert(presentations)
          .values({
            productId,
            name: presentation.name,
            unitsPer: presentation.unitsPer,
          })
          .onConflictDoNothing({
            target: [presentations.productId, presentations.name],
          })
          .returning({ id: presentations.id });

        const presentationId =
          createdPresentation?.id ??
          (
            await tx
              .select({ id: presentations.id })
              .from(presentations)
              .where(and(eq(presentations.productId, productId), eq(presentations.name, presentation.name)))
              .limit(1)
          )[0]?.id;
        if (!presentationId)
          throw new Error(`No se pudo sembrar la presentación ${demo.name} · ${presentation.name}`);

        const [existingPrice] = await tx
          .select({ id: priceHistory.id })
          .from(priceHistory)
          .where(eq(priceHistory.presentationId, presentationId))
          .limit(1);
        if (existingPrice) continue;

        if (presentation.previousPrice) {
          await tx.insert(priceHistory).values({
            presentationId,
            price: presentation.previousPrice.price,
            validFrom: new Date(presentation.previousPrice.validFrom),
            validTo: new Date(CURRENT_FROM),
            setBy: setByUserId,
          });
        }
        await tx.insert(priceHistory).values({
          presentationId,
          price: presentation.price,
          validFrom: new Date(CURRENT_FROM),
          validTo: null,
          setBy: setByUserId,
        });
      }
    }

    for (const material of DEMO_RAW_MATERIALS) {
      await tx.insert(rawMaterials).values(material).onConflictDoNothing({ target: rawMaterials.name });
    }
  });
}
