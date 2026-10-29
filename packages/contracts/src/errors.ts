import { z } from 'zod';

/**
 * Formato único de error inspirado en RFC 9457 (api-design.md §3).
 * Los códigos son estables: el frontend y los complementos dependen de ellos.
 */
export const ErrorCode = z.enum([
  'MALFORMED_REQUEST',
  'UNAUTHENTICATED',
  'MFA_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'CONCURRENT_UPDATE',
  'PRECONDITION_FAILED',
  'VALIDATION_FAILED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_IN_PROGRESS',
  'FEATURE_BLOCKED',
  'RATE_LIMITED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const FieldError = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
});

export const ProblemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.array(FieldError).optional(),
  approval: z
    .object({ required: z.boolean(), policy: z.string(), requestId: z.string().nullable() })
    .optional(),
  blockedBy: z.string().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetails>;
