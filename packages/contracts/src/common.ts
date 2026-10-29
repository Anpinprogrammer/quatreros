import { z } from 'zod';

/**
 * Tipos base compartidos. Convenciones de api-design.md §1.
 * Dinero y cantidades viajan como CADENAS decimales, nunca como number (ADR-008, DEC-P22).
 */

/** Monto en COP con hasta 2 decimales, no negativo. Ej.: "12000.00" */
export const Money = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Monto inválido: use una cadena decimal con máximo 2 decimales')
  .describe('Monto en COP como cadena decimal');
export type Money = z.infer<typeof Money>;

/** Cantidad positiva con hasta 3 decimales. Ej.: "2.500" */
export const Quantity = z
  .string()
  .regex(/^\d{1,11}(\.\d{1,3})?$/, 'Cantidad inválida: use una cadena decimal con máximo 3 decimales')
  .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor que 0')
  .describe('Cantidad como cadena decimal');
export type Quantity = z.infer<typeof Quantity>;

export const Uuid = z.uuid();
export type Uuid = z.infer<typeof Uuid>;

/** Fecha de negocio (America/Bogota), sin hora. */
export const BusinessDate = z.iso.date();

/** Canales desde los que se ejecuta una operación (auditoría, BR-005). */
export const Channel = z.enum(['web', 'assistant', 'telegram', 'system']);
export type Channel = z.infer<typeof Channel>;

/** Cabecera obligatoria en escrituras críticas (ADR-010, BR-007). */
export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const IdempotencyKey = z.uuid({ message: 'Idempotency-Key debe ser un UUID' });

/** Paginación por cursor (api-design §2). */
export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(500).optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    page: z.object({ nextCursor: z.string().nullable(), limit: z.number().int() }),
  });
