import type { MeResponse, Shell } from '@quatreros/contracts';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../../hooks/useSession';
import { canUseShell } from '../../lib/session';

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
