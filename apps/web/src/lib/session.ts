import type { MeResponse, RoleCode, Shell } from '@quatreros/contracts';

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
