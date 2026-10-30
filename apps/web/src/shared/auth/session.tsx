import type { MeResponse, RoleCode, Shell } from '@quatreros/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ApiError, apiRequest } from '../api/client';
import { authClient } from './client';

export const ME_KEY = ['me'] as const;

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: 'disabled' | 'not_provisioned' }
  | { status: 'authenticated'; me: MeResponse };

/** Usuario actual. `null` = sin sesión. */
export function useSession(): SessionState {
  const query = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await apiRequest<MeResponse>('/api/v1/me');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ACCOUNT_DISABLED')
          return { anonymous: 'disabled' as const };
        if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_PROVISIONED')
          return { anonymous: 'not_provisioned' as const };
        if (err instanceof ApiError && err.status === 401) return { anonymous: undefined };
        throw err;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
  if (query.isPending) return { status: 'loading' };
  const data = query.data;
  if (!data || 'anonymous' in data) {
    return data?.anonymous ? { status: 'anonymous', reason: data.anonymous } : { status: 'anonymous' };
  }
  return { status: 'authenticated', me: data };
}

export function useSignOut() {
  const client = useQueryClient();
  return async () => {
    await authClient.signOut();
    client.clear();
    window.location.assign('/ingresar');
  };
}

const SHELL_ROLES: Record<Shell, RoleCode[]> = {
  erp: ['ADM', 'MGR', 'COMP', 'PROD', 'CONT'],
  pos: ['ADM', 'MGR', 'CAJ'],
  ruta: ['ADM', 'MGR', 'DIST'],
};

export function canUseShell(me: MeResponse, shell: Shell): boolean {
  return me.roles.some((r) => SHELL_ROLES[shell].includes(r.code));
}

export function hasPermission(me: MeResponse, permission: string): boolean {
  return permission in me.permissions;
}

export function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <p className="text-ash">{children}</p>
    </main>
  );
}

/**
 * Guarda de rutas: exige sesión, segundo factor si el rol lo pide (DEC-043) y acceso al shell.
 * La autorización real está en el servidor; esto solo evita mostrar pantallas inútiles.
 */
export function RequireSession({
  shell,
  children,
}: {
  shell?: Shell;
  children: (me: MeResponse) => ReactNode;
}) {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <FullPageMessage>Cargando…</FullPageMessage>;
  if (session.status === 'anonymous') {
    const next = encodeURIComponent(location.pathname);
    return (
      <Navigate
        to={`/ingresar?siguiente=${next}${session.reason ? `&motivo=${session.reason}` : ''}`}
        replace
      />
    );
  }
  const { me } = session;
  if (me.mfa.required && !me.mfa.enabled) return <Navigate to="/seguridad/segundo-factor" replace />;
  if (shell && !canUseShell(me, shell)) return <Navigate to={`/${me.homeShell}`} replace />;
  return <>{children(me)}</>;
}
