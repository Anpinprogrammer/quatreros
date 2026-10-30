import type { MeResponse } from '@quatreros/contracts';
import { hasPermission } from './auth/session';

/**
 * Secciones del ERP (pestañas del encabezado, sistema de diseño Parte 2 + Anexo B) y sus módulos con el
 * estado real de construcción. Se actualiza al terminar cada entrega (docs/03-planning/roadmap-prototipo.md).
 */
export type ModuleStatus =
  { kind: 'available' } | { kind: 'pending'; delivery: number } | { kind: 'blocked'; by: string };

export interface ModuleEntry {
  id: string;
  name: string;
  description: string;
  status: ModuleStatus;
  /** Ruta dentro del ERP cuando el módulo está disponible. */
  path?: string;
  /** Permiso necesario para abrirlo. */
  permission?: string;
}

export interface Section {
  id: string;
  /** Número de pestaña como en el boceto ("01. Command Center"). */
  number: string;
  name: string;
  path: string;
  modules: ModuleEntry[];
}

const soon = (delivery: number): ModuleStatus => ({ kind: 'pending', delivery });

export const SECTIONS: Section[] = [
  { id: 'inicio', number: '01', name: 'Command Center', path: '/erp', modules: [] },
  {
    id: 'pos',
    number: '02',
    name: 'POS/Cocina',
    path: '/erp/seccion/pos',
    modules: [
      {
        id: 'caja',
        name: 'Caja: turnos y arqueos',
        description: 'Ventas, pagos mixtos, cierre de turno y revisión de diferencias',
        status: soon(6),
      },
      {
        id: 'mermas-cocina',
        name: 'Mermas de cocina',
        description: 'Clasificación de mermas del punto de asados',
        status: { kind: 'blocked', by: 'P-07' },
      },
    ],
  },
  {
    id: 'reparto',
    number: '03',
    name: 'Reparto',
    path: '/erp/seccion/reparto',
    modules: [
      {
        id: 'pedidos',
        name: 'Clientes y pedidos',
        description: 'Pedidos, crédito y pendientes',
        status: soon(5),
      },
      {
        id: 'despachos',
        name: 'Despachos y entregas',
        description: 'Asignación, entregas parciales y devoluciones',
        status: soon(5),
      },
      {
        id: 'liquidacion',
        name: 'Liquidación de repartidores',
        description: 'Cuadre de mercancía y dinero',
        status: { kind: 'blocked', by: 'P-08' },
      },
    ],
  },
  {
    id: 'produccion',
    number: '04',
    name: 'Producción',
    path: '/erp/seccion/produccion',
    modules: [
      {
        id: 'ordenes',
        name: 'Órdenes de producción',
        description: 'Recetas, consumo real por lote y rendimiento',
        status: soon(4),
      },
      {
        id: 'existencias',
        name: 'Existencias y traslados',
        description: 'Lotes, vencimientos, FEFO y trazabilidad',
        status: soon(2),
      },
      {
        id: 'paquetes',
        name: 'Apertura de paquetes',
        description: 'Convertir paquetes en unidades',
        status: { kind: 'blocked', by: 'P-06' },
      },
    ],
  },
  {
    id: 'ia',
    number: '05',
    name: 'IA Log',
    path: '/erp/seccion/ia',
    modules: [
      {
        id: 'asistente',
        name: 'Asistente de IA',
        description: 'Consultas en lenguaje natural y registros con confirmación',
        status: soon(8),
      },
    ],
  },
  {
    id: 'compras',
    number: '06',
    name: 'Compras',
    path: '/erp/seccion/compras',
    modules: [
      {
        id: 'compras',
        name: 'Compras y recepción',
        description: 'Proveedores, compras y lotes de materia prima',
        status: soon(3),
      },
    ],
  },
  {
    id: 'dinero',
    number: '07',
    name: 'Cartera y contabilidad',
    path: '/erp/seccion/dinero',
    modules: [
      {
        id: 'cartera',
        name: 'Cartera y recaudos',
        description: 'Cupos, abonos y conciliación',
        status: soon(7),
      },
      {
        id: 'contabilidad',
        name: 'Contabilidad',
        description: 'Hechos económicos, cuentas y asientos',
        status: { kind: 'blocked', by: 'P-01 a P-04' },
      },
    ],
  },
  {
    id: 'administracion',
    number: '08',
    name: 'Administración',
    path: '/erp/seccion/administracion',
    modules: [
      {
        id: 'usuarios',
        name: 'Usuarios y permisos',
        description: 'Usuarios, roles y sedes (matriz de permisos provisional)',
        status: { kind: 'available' },
        path: '/erp/usuarios',
        permission: 'adm.user.read',
      },
    ],
  },
];

/** Sección a la que pertenece una ruta del ERP (para marcar la pestaña activa). */
export function sectionForPath(pathname: string): Section | undefined {
  if (pathname === '/erp' || pathname === '/erp/') return SECTIONS[0];
  return SECTIONS.find(
    (s) =>
      s.id !== 'inicio' &&
      (pathname.startsWith(s.path) || s.modules.some((m) => m.path && pathname.startsWith(m.path))),
  );
}

export function statusLabel(status: ModuleStatus): string {
  switch (status.kind) {
    case 'available':
      return 'Disponible';
    case 'pending':
      return `En construcción · entrega ${String(status.delivery)}`;
    case 'blocked':
      return `Espera decisión ${status.by}`;
  }
}

/** Un módulo se puede abrir si está construido y el usuario tiene el permiso (el servidor vuelve a validar). */
export function isUsable(module: ModuleEntry, me: MeResponse): boolean {
  return (
    module.status.kind === 'available' &&
    Boolean(module.path) &&
    (!module.permission || hasPermission(me, module.permission))
  );
}
