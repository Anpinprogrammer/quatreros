import { describe, expect, it } from 'vitest';
import { IDLE_LIMITS_MS, shellForActor } from '../../src/platform/auth/activity.js';

describe('expiración por inactividad (RNF-006, DEC-107)', () => {
  it('usa 30 min para el ERP', () => {
    expect(shellForActor({ roleCodes: ['COMP'] })).toBe('erp');
    expect(IDLE_LIMITS_MS.erp).toBe(30 * 60 * 1000);
  });

  it('usa 12 h para el POS', () => {
    expect(shellForActor({ roleCodes: ['CAJ'] })).toBe('pos');
    expect(IDLE_LIMITS_MS.pos).toBe(12 * 60 * 60 * 1000);
  });

  it('usa 8 h para el portal móvil', () => {
    expect(shellForActor({ roleCodes: ['DIST'] })).toBe('ruta');
    expect(IDLE_LIMITS_MS.ruta).toBe(8 * 60 * 60 * 1000);
  });

  it('un rol de ERP conserva el límite más restrictivo si además tiene POS', () => {
    expect(shellForActor({ roleCodes: ['MGR', 'CAJ'] })).toBe('erp');
  });
});
