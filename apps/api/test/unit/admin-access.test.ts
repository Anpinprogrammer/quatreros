import { describe, expect, it } from 'vitest';
import {
  decide,
  effectivePermissions,
  homeShell,
  scopeFilter,
  wouldRemoveLastAdmin,
  type AccessSubject,
} from '../../src/modules/admin/domain/access.js';
import { PERMISSIONS, ROLES } from '../../src/modules/admin/domain/permission-catalog.js';

const BODEGA = 'site-bodega';
const PUNTO = 'site-punto';

const subject = (perms: Record<string, 'ALL' | 'SITE' | 'OWN'>, siteIds = [PUNTO]): AccessSubject => ({
  userId: 'u-1',
  siteIds,
  permissions: new Map(Object.entries(perms)),
});

describe('permisos efectivos', () => {
  it('gana el alcance más amplio entre roles', () => {
    const eff = effectivePermissions([
      { code: 'inv.stock.read', scope: 'OWN' },
      { code: 'inv.stock.read', scope: 'SITE' },
      { code: 'pos.sale.create', scope: 'OWN' },
    ]);
    expect(eff.get('inv.stock.read')).toBe('SITE');
    expect(eff.get('pos.sale.create')).toBe('OWN');
  });
});

describe('decide (BR-001, BR-002)', () => {
  it('sin permiso → no_permission', () => {
    expect(decide(subject({}), 'adm.user.read')).toBe('no_permission');
  });
  it('alcance SITE: sede propia sí, ajena no (404 sin revelar)', () => {
    const s = subject({ 'inv.stock.read': 'SITE' });
    expect(decide(s, 'inv.stock.read', { siteId: PUNTO })).toBe('allow');
    expect(decide(s, 'inv.stock.read', { siteId: BODEGA })).toBe('out_of_scope');
  });
  it('alcance OWN: solo registros asignados al usuario', () => {
    const s = subject({ 'dis.delivery.register': 'OWN' }, [BODEGA]);
    expect(decide(s, 'dis.delivery.register', { siteId: BODEGA, ownerId: 'u-1' })).toBe('allow');
    expect(decide(s, 'dis.delivery.register', { siteId: BODEGA, ownerId: 'u-2' })).toBe('out_of_scope');
  });
  it('alcance ALL: cualquier sede', () => {
    expect(decide(subject({ 'adm.user.read': 'ALL' }), 'adm.user.read', { siteId: BODEGA })).toBe('allow');
  });
});

describe('scopeFilter', () => {
  it('traduce el alcance a filtro de listado', () => {
    expect(scopeFilter(subject({ x: 'ALL' }), 'x')).toEqual({ kind: 'all' });
    expect(scopeFilter(subject({ x: 'SITE' }), 'x')).toEqual({ kind: 'sites', siteIds: [PUNTO] });
    expect(scopeFilter(subject({ x: 'OWN' }), 'x')).toMatchObject({ kind: 'own', userId: 'u-1' });
    expect(scopeFilter(subject({}), 'x')).toBeNull();
  });
});

describe('pantalla de inicio por rol', () => {
  it('cajero → pos, distribuidor → ruta, administrativos → erp', () => {
    expect(homeShell(['CAJ'])).toBe('pos');
    expect(homeShell(['DIST'])).toBe('ruta');
    expect(homeShell(['CAJ', 'MGR'])).toBe('erp');
    expect(homeShell(['CONT'])).toBe('erp');
  });
});

describe('regla del último administrador', () => {
  it('impide dejar el sistema sin administradores activos', () => {
    expect(wouldRemoveLastAdmin(['a'], 'a', false)).toBe(true);
    expect(wouldRemoveLastAdmin(['a', 'b'], 'a', false)).toBe(false);
    expect(wouldRemoveLastAdmin(['a'], 'a', true)).toBe(false);
    expect(wouldRemoveLastAdmin(['a'], 'b', false)).toBe(false);
  });
});

describe('catálogo de permisos (Q-B-01 provisional)', () => {
  it('cada permiso otorgado existe en el catálogo', () => {
    for (const role of ROLES) {
      for (const code of Object.keys(role.grants))
        expect(PERMISSIONS[code], `${role.code}:${code}`).toBeDefined();
    }
  });
  it('MFA obligatorio para ADM, MGR y CONT (DEC-043)', () => {
    expect(ROLES.filter((r) => r.requiresMfa).map((r) => r.code)).toEqual(['ADM', 'MGR', 'CONT']);
  });
  it('nadie tiene escrituras asistidas mientras siga bloqueado (BR-234)', () => {
    expect(ROLES.some((r) => 'ia.write' in r.grants)).toBe(false);
  });
  it('el contador no registra caja ni ventas (segregación propuesta)', () => {
    const cont = ROLES.find((r) => r.code === 'CONT');
    expect(cont?.grants['pos.sale.create']).toBeUndefined();
    expect(cont?.grants['fin.collection.register']).toBeUndefined();
  });
});
