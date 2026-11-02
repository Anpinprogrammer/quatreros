import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Cliente de autenticación (Better Auth, ADR-007). Usa el mismo origen que la SPA:
 * en desarrollo Vite redirige /api a la API; en producción la API sirve la SPA.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [twoFactorClient()],
});
