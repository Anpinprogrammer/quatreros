import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import type { Env } from '../../config/env.js';
import type { Database } from '../db/client.js';
import * as authSchema from '../db/schema/auth.js';

/**
 * Autenticación (ADR-007, security-design §2).
 * - Correo + contraseña (mín. 12 caracteres). Sin registro público: los usuarios los crea el
 *   Administrador (RF-003).
 * - MFA TOTP con el plugin two-factor; la obligatoriedad por rol la aplica el módulo admin.
 * - Sesiones en base de datos, revocables.
 * La AUTORIZACIÓN (roles, sedes, aprobaciones) es propia y vive en el módulo admin.
 */
export interface AuthOptions {
  /** Devuelve true si la cuenta de negocio está desactivada: no se le crea sesión (BR-010). */
  isBlocked?: (authUserId: string) => Promise<boolean>;
}

export function createAuth(db: Database, env: Env, options: AuthOptions = {}) {
  return betterAuth({
    appName: 'Quatreros',
    baseURL: env.APP_BASE_URL,
    basePath: '/api/auth',
    ...(env.BETTER_AUTH_SECRET ? { secret: env.BETTER_AUTH_SECRET } : {}),
    trustedOrigins: [env.APP_BASE_URL],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: authSchema.user,
        session: authSchema.session,
        account: authSchema.account,
        verification: authSchema.verification,
        twoFactor: authSchema.twoFactor,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: 60 * 60 * 12, // 12 h (POS por turno); el shell ERP aplica inactividad propia (RNF-006, PENDING)
      updateAge: 60 * 15,
    },
    // Incluye la regla propia de Better Auth para /sign-in (3 intentos / 10 s por IP).
    rateLimit: { enabled: env.NODE_ENV !== 'test' && !env.AUTH_RATE_LIMIT_DISABLED, window: 60, max: 20 },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (options.isBlocked && (await options.isBlocked(session.userId))) return false;
            return { data: session };
          },
        },
      },
    },
    plugins: [twoFactor({ issuer: 'Quatreros' })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
