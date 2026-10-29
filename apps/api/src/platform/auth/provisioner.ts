import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { account, user } from '../db/schema/auth.js';
import type { Auth } from './auth.js';

/**
 * Alta de credenciales desde el servidor (el registro público está apagado, RF-003).
 * Usa la API interna de Better Auth para que el hash de la contraseña sea el mismo que valida el ingreso.
 */
export interface AuthProvisioner {
  createCredentialUser(input: { name: string; email: string; password: string }): Promise<string>;
  deleteAuthUser(authUserId: string): Promise<void>;
}

export function createAuthProvisioner(auth: Auth, db: Database): AuthProvisioner {
  return {
    async createCredentialUser({ name, email, password }) {
      const ctx = await auth.$context;
      const created = await ctx.internalAdapter.createUser(
        { name, email, emailVerified: true },
        { method: 'admin' },
      );
      await ctx.internalAdapter.createAccount({
        userId: created.id,
        providerId: 'credential',
        accountId: created.id,
        password: await ctx.password.hash(password),
      });
      return created.id;
    },
    async deleteAuthUser(authUserId) {
      // Compensación si falla el alta de negocio: no deja credenciales huérfanas.
      await db.delete(account).where(eq(account.userId, authUserId));
      await db.delete(user).where(eq(user.id, authUserId));
    },
  };
}
