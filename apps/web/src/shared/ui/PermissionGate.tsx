import type { MeResponse } from '@quatreros/contracts';
import type { ReactNode } from 'react';
import { hasPermission } from '../auth/session';

/**
 * Oculta acciones para las que no hay permiso. No sustituye la autorización del servidor:
 * es solo presentación (DEC-041, DEC-042).
 */
export function PermissionGate({
  me,
  permission,
  mode = 'all',
  fallback = null,
  children,
}: {
  me: MeResponse;
  permission: string | string[];
  mode?: 'all' | 'any';
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const list = Array.isArray(permission) ? permission : [permission];
  const allowed =
    list.length > 0 &&
    (mode === 'all' ? list.every((p) => hasPermission(me, p)) : list.some((p) => hasPermission(me, p)));
  return <>{allowed ? children : fallback}</>;
}
