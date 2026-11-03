import { createHash } from 'node:crypto';
import { CreateRawMaterialRequest, CreateRecipeRequest } from '@quatreros/contracts';
import { z } from 'zod';
import type { Database } from '../../../platform/db/client.js';
import type { ExecutionContext } from '../../../platform/http/context.js';
import { authorize } from '../../../modules/admin/application/public.js';
import {
  createRawMaterial,
  createRecipe,
  getProduct,
  listProducts,
  listRawMaterials,
} from '../../../modules/catalog/application/public.js';
import { agingReport, getCustomerBalance } from '../../../modules/finance/application/public.js';
import {
  businessToday,
  listAvailability,
  listLots,
  traceLot,
} from '../../../modules/inventory/application/public.js';
import { listCustomers, listOrders } from '../../../modules/sales/application/public.js';

/** El catálogo solo exige el puerto para cambios; las lecturas y el alta no lo usan. */
const NO_INVENTORY_USAGE = {
  hasStockOrMovementsForProduct: () => Promise.resolve(false),
  hasStockOrMovementsForPresentation: () => Promise.resolve(false),
  hasStockOrMovementsForRawMaterial: () => Promise.resolve(false),
};

export type ReadToolName =
  | 'inventory_get_availability'
  | 'inventory_get_expiring_lots'
  | 'inventory_trace_lot'
  | 'catalog_search_products'
  | 'catalog_search_raw_materials'
  | 'sales_list_open_orders'
  | 'sales_search_customers'
  | 'finance_get_customer_balance'
  | 'finance_get_overdue_receivables';

export type WriteToolName = 'prepare_raw_material' | 'prepare_recipe';

export interface PreparedTool {
  toolName: WriteToolName;
  arguments: Record<string, unknown>;
  summary: Record<string, unknown>;
  summaryText: string;
  argumentsHash: string;
}

export interface ExecutedTool {
  entityType: 'catalog.raw_material' | 'catalog.recipe';
  entityId: string;
  summary: string;
}

const availabilityInput = z.object({
  q: z.string().trim().max(100).optional(),
  presentationId: z.uuid().optional(),
  productId: z.uuid().optional(),
  rawMaterialId: z.uuid().optional(),
});
const expiringInput = z.object({
  days: z.number().int().min(1).max(90).default(7),
  productId: z.uuid().optional(),
  rawMaterialId: z.uuid().optional(),
});
const traceInput = z.object({ lotId: z.uuid() });
const productSearchInput = z.object({
  q: z.string().trim().min(1).max(100),
  kind: z.enum(['manufactured', 'prepared']).optional(),
});
const openOrdersInput = z.object({
  status: z
    .enum(['draft', 'confirmed', 'in_dispatch', 'partially_delivered', 'delivered', 'cancelled'])
    .optional(),
});
const rawMaterialSearchInput = z.object({ q: z.string().trim().min(1).max(100) });
const customerSearchInput = z.object({ q: z.string().trim().min(1).max(100) });
const customerBalanceInput = z.object({ customerId: z.uuid() });
const emptyInput = z.object({}).default({});

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Catálogo de herramientas del asistente. Toda lectura y escritura pasa por casos de uso
 * existentes; el gateway nunca recibe identidad del modelo (BR-230, DEC-106).
 */
export function hashToolArguments(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export class ToolGateway {
  constructor(private readonly db: Database) {}

  async read(name: ReadToolName, raw: unknown, ctx: ExecutionContext): Promise<unknown> {
    const toolCtx: ExecutionContext = { ...ctx, channel: 'assistant' };
    switch (name) {
      case 'inventory_get_availability': {
        const input = availabilityInput.parse(raw);
        const result = await listAvailability({ db: this.db }, toolCtx, {
          ...input,
          limit: 20,
        });
        return result.data;
      }
      case 'inventory_get_expiring_lots': {
        const input = expiringInput.parse(raw);
        const result = await listLots({ db: this.db }, toolCtx, {
          expiresBefore: addDays(businessToday(), input.days),
          ...(input.productId ? { productId: input.productId } : {}),
          ...(input.rawMaterialId ? { rawMaterialId: input.rawMaterialId } : {}),
          limit: 20,
        });
        return result.data;
      }
      case 'inventory_trace_lot': {
        const input = traceInput.parse(raw);
        return traceLot({ db: this.db }, toolCtx, input.lotId);
      }
      case 'catalog_search_products': {
        const input = productSearchInput.parse(raw);
        const result = await listProducts({ db: this.db, inventoryUsage: NO_INVENTORY_USAGE }, toolCtx, {
          q: input.q,
          ...(input.kind ? { kind: input.kind } : {}),
          limit: 10,
        });
        return result.data.map((product) => ({
          id: product.id,
          name: product.name,
          kind: product.kind,
          baseUnit: product.baseUnit,
          presentations: product.presentations.map((presentation) => ({
            id: presentation.id,
            name: presentation.name,
            unitsPer: presentation.unitsPer,
          })),
        }));
      }
      case 'catalog_search_raw_materials': {
        const input = rawMaterialSearchInput.parse(raw);
        const result = await listRawMaterials({ db: this.db, inventoryUsage: NO_INVENTORY_USAGE }, toolCtx, {
          q: input.q,
          status: 'active',
          limit: 10,
        });
        return result.data.map((material) => ({
          id: material.id,
          name: material.name,
          unit: material.unit,
          tracksExpiry: material.tracksExpiry,
        }));
      }
      case 'sales_list_open_orders': {
        const input = openOrdersInput.parse(raw);
        const result = await listOrders({ db: this.db }, toolCtx, {
          ...(input.status ? { status: input.status } : {}),
          limit: 20,
        });
        return result.data.filter((order) => !['delivered', 'cancelled'].includes(order.status));
      }
      case 'sales_search_customers': {
        const input = customerSearchInput.parse(raw);
        const result = await listCustomers({ db: this.db }, toolCtx, {
          q: input.q,
          status: 'active',
          limit: 10,
        });
        return result.data.map((customer) => ({
          id: customer.id,
          name: customer.name,
          kind: customer.kind,
          phone: customer.phone,
        }));
      }
      case 'finance_get_customer_balance': {
        const input = customerBalanceInput.parse(raw);
        return getCustomerBalance(this.db, toolCtx, input.customerId, 'fin.receivable.read');
      }
      case 'finance_get_overdue_receivables': {
        emptyInput.parse(raw);
        const aging = await agingReport(this.db, toolCtx, {});
        return {
          asOf: aging.asOf,
          totals: aging.totals,
          customers: aging.customers.filter((customer) => Number(customer.overdue) > 0).slice(0, 20),
        };
      }
    }
  }

  async prepare(name: WriteToolName, raw: unknown, ctx: ExecutionContext): Promise<PreparedTool> {
    const toolCtx: ExecutionContext = { ...ctx, channel: 'assistant' };
    if (name === 'prepare_raw_material') {
      authorize(toolCtx, 'cat.raw_material.manage');
      const input = CreateRawMaterialRequest.parse(raw);
      const argumentsValue = {
        name: input.name,
        unit: input.unit,
        tracksExpiry: input.tracksExpiry,
      };
      return {
        toolName: name,
        arguments: argumentsValue,
        summary: {
          entity: 'Materia prima',
          name: input.name,
          unit: input.unit,
          tracksExpiry: input.tracksExpiry,
        },
        summaryText: `Crear materia prima “${input.name}” en ${input.unit}${
          input.tracksExpiry ? ' con control de vencimiento' : ' sin control de vencimiento'
        }.`,
        argumentsHash: createHash('sha256').update(stableStringify(argumentsValue)).digest('hex'),
      };
    }

    authorize(toolCtx, 'prod.recipe.manage');
    const input = CreateRecipeRequest.parse(raw);
    const product = await getProduct(
      { db: this.db, inventoryUsage: NO_INVENTORY_USAGE },
      toolCtx,
      input.productId,
    );
    const rawMaterials = await listRawMaterials(
      { db: this.db, inventoryUsage: NO_INVENTORY_USAGE },
      toolCtx,
      {
        status: 'active',
        limit: 100,
      },
    );
    const byId = new Map(rawMaterials.data.map((item) => [item.id, item]));
    const lines = input.lines.map((line) => {
      const material = byId.get(line.rawMaterialId);
      if (!material) {
        throw new Error(`La materia prima ${line.rawMaterialId} no existe o está inactiva.`);
      }
      return {
        rawMaterialId: material.id,
        rawMaterialName: material.name,
        quantity: line.quantity,
        unit: material.unit,
      };
    });
    const argumentsValue = {
      productId: input.productId,
      baseOutputQty: input.baseOutputQty,
      ...(input.expectedYieldPct ? { expectedYieldPct: input.expectedYieldPct } : {}),
      ...(input.tolerancePct ? { tolerancePct: input.tolerancePct } : {}),
      lines: input.lines,
    };
    return {
      toolName: name,
      arguments: argumentsValue,
      summary: {
        entity: 'Receta',
        productId: product.id,
        productName: product.name,
        baseOutputQty: input.baseOutputQty,
        expectedYieldPct: input.expectedYieldPct ?? null,
        tolerancePct: input.tolerancePct ?? null,
        lines,
      },
      summaryText: `Crear receta de “${product.name}” con salida base ${input.baseOutputQty} y estos ingredientes: ${lines
        .map((line) => `${line.rawMaterialName} ${line.quantity} ${line.unit}`)
        .join(', ')}.`,
      argumentsHash: createHash('sha256').update(stableStringify(argumentsValue)).digest('hex'),
    };
  }

  async execute(name: WriteToolName, raw: unknown, ctx: ExecutionContext): Promise<ExecutedTool> {
    const toolCtx: ExecutionContext = { ...ctx, channel: 'assistant' };
    if (name === 'prepare_raw_material') {
      const input = CreateRawMaterialRequest.parse(raw);
      const result = await createRawMaterial(
        { db: this.db, inventoryUsage: NO_INVENTORY_USAGE },
        toolCtx,
        input,
      );
      return {
        entityType: 'catalog.raw_material',
        entityId: result.id,
        summary: `Materia prima “${result.name}” creada.`,
      };
    }
    const input = CreateRecipeRequest.parse(raw);
    const result = await createRecipe({ db: this.db }, toolCtx, input);
    return {
      entityType: 'catalog.recipe',
      entityId: result.id,
      summary: `Receta de “${result.productName}” creada.`,
    };
  }
}
