import { z } from 'zod';

/**
 * Configuración validada al arrancar. Si falta algo obligatorio, el proceso no inicia
 * (falla rápido y con mensaje claro). Variables documentadas en /.env.example.
 */
const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_BASE_URL: z.url().default('http://localhost:5173'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TZ_BUSINESS: z.string().default('America/Bogota'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    DATABASE_SSL: booleanFromString,
    BETTER_AUTH_SECRET: z.string().optional(),
    APP_VERSION: z.string().default('0.1.0'),
  })
  .superRefine((env, ctx) => {
    const needsSecret = env.NODE_ENV === 'staging' || env.NODE_ENV === 'production';
    if (needsSecret && (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'BETTER_AUTH_SECRET es obligatoria (mín. 32 caracteres) en staging y producción',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${detail}`);
  }
  return parsed.data;
}
