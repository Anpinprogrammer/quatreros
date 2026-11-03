import type { MeResponse } from '@quatreros/contracts';
import { hasPermission } from '../lib/session';

/**
 * Secciones del ERP y estado real de construcción de cada módulo. Se actualiza al terminar
 * cada entrega (docs/03-planning/roadmap-prototipo.md). La navegación solo presenta lo que
 * existe: los módulos pendientes o bloqueados conservan su señalización y no se abren.
 */
export type ModuleStatus =
  { kind: 'available' } | { kind: 'pending'; delivery: number } | { kind: 'blocked'; by: string };

export type ModuleIconName =
  | 'command'
  | 'pos'
  | 'production'
  | 'inventory'
  | 'distribution'
  | 'purchases'
  | 'orders'
  | 'cash'
  | 'kitchenWaste'
  | 'dispatch'
  | 'settlement'
  | 'wallet'
  | 'accounting'
  | 'admin'
  | 'ai'
  | 'catalog'
  | 'factory'
  | 'boxes'
  | 'packageOpen'
  | 'credit'
  | 'users';

export interface ModuleEntry {
  id: string;
  name: string;
  description: string;
  status: ModuleStatus;
  icon: ModuleIconName;
  /** Ruta dentro del ERP cuando el módulo está disponible. */
  path?: string;
  /** Permiso necesario para abrirlo. */
  permission?: string;
}

export interface Section {
  id: string;
  /** Número de área como en el sistema de diseño ("01. Command Center"). */
  number: string;
  name: string;
  description: string;
  path: string;
  icon: ModuleIconName;
  /** Si se define, la sección solo aparece en la navegación cuando el usuario tiene el permiso. */
  permission?: string;
  modules: ModuleEntry[];
}

export const SECTIONS: Section[] = [
  {
    id: 'inicio',
    number: '01',
    name: 'Command Center',
    description: 'El pulso de la operación, en un solo lugar.',
    path: '/erp',
    icon: 'command',
    modules: [],
  },
  {
    id: 'pos',
    number: '02',
    name: 'POS y cocina',
    description: 'Ventas de mostrador, turnos de caja y operación de cocina.',
    path: '/erp/seccion/pos',
    icon: 'pos',
    modules: [
      {
        id: 'caja',
        name: 'Caja: turnos y arqueos',
        description: 'Ventas, pagos mixtos y cierre de turno',
        status: { kind: 'available' },
        icon: 'cash',
        path: '/pos',
        permission: 'pos.sale.create',
      },
      {
        id: 'diferencias',
        name: 'Diferencias de caja',
        description: 'Revisión de cierres con diferencia por el supervisor',
        status: { kind: 'available' },
        icon: 'settlement',
        path: '/erp/pos/revision',
        permission: 'pos.cash_variance.review',
      },
      {
        id: 'recetas-platos',
        name: 'Recetas de platos',
        description: 'Ingredientes y consumo teórico de los platos preparados',
        status: { kind: 'available' },
        icon: 'catalog',
        path: '/erp/pos/recetas',
        permission: 'pos.dish_recipe.manage',
      },
      {
        id: 'mermas-cocina',
        name: 'Mermas de cocina',
        description: 'Clasificación de mermas del punto de asados',
        status: { kind: 'blocked', by: 'P-07' },
        icon: 'kitchenWaste',
      },
    ],
  },
  {
    id: 'produccion',
    number: '04',
    name: 'Producción',
    description: 'Gestiona tus productos, órdenes y existencias desde un solo lugar.',
    path: '/erp/seccion/produccion',
    icon: 'production',
    modules: [
      {
        id: 'catalogo',
        name: 'Catálogo y precios',
        description: 'Productos, presentaciones, materias primas y precios con histórico',
        status: { kind: 'available' },
        icon: 'catalog',
        path: '/erp/catalogo',
        permission: 'cat.product.read',
      },
      {
        id: 'ordenes',
        name: 'Órdenes de producción',
        description: 'Recetas, consumo real por lote y rendimiento',
        status: { kind: 'available' },
        icon: 'factory',
        path: '/erp/produccion',
        permission: 'prod.order.read',
      },
      {
        id: 'existencias',
        name: 'Existencias y traslados',
        description: 'Lotes, vencimientos, kardex y trazabilidad',
        status: { kind: 'available' },
        icon: 'boxes',
        path: '/erp/existencias',
        permission: 'inv.stock.read',
      },
      {
        id: 'paquetes',
        name: 'Apertura de paquetes',
        description: 'Convertir paquetes en unidades',
        status: { kind: 'blocked', by: 'P-06' },
        icon: 'packageOpen',
      },
    ],
  },
  {
    id: 'reparto',
    number: '03',
    name: 'Distribución',
    description: 'Pedidos, despachos y entregas en calle.',
    path: '/erp/seccion/reparto',
    icon: 'distribution',
    modules: [
      {
        id: 'pedidos',
        name: 'Clientes y pedidos',
        description: 'Pedidos, crédito y pendientes',
        status: { kind: 'available' },
        icon: 'orders',
        path: '/erp/ventas',
        permission: 'com.order.read',
      },
      {
        id: 'despachos',
        name: 'Despachos y entregas',
        description: 'Asignación, entregas parciales y devoluciones',
        status: { kind: 'available' },
        icon: 'dispatch',
        path: '/erp/ventas',
        permission: 'dis.dispatch.read',
      },
      {
        id: 'liquidacion',
        name: 'Liquidación de repartidores',
        description: 'Cuadre de mercancía y dinero',
        status: { kind: 'blocked', by: 'P-08' },
        icon: 'settlement',
      },
    ],
  },
  {
    id: 'compras',
    number: '06',
    name: 'Compras',
    description: 'Proveedores, órdenes de compra y recepción de materia prima.',
    path: '/erp/seccion/compras',
    icon: 'purchases',
    modules: [
      {
        id: 'compras',
        name: 'Compras y recepción',
        description: 'Proveedores, compras y lotes de materia prima',
        status: { kind: 'available' },
        icon: 'purchases',
        path: '/erp/compras',
        permission: 'comp.purchase.read',
      },
    ],
  },
  {
    id: 'dinero',
    number: '07',
    name: 'Cartera y contabilidad',
    description: 'Cupos, recaudos y contabilidad formal.',
    path: '/erp/seccion/dinero',
    icon: 'wallet',
    modules: [
      {
        id: 'cartera',
        name: 'Cartera y recaudos',
        description: 'Antigüedad, abonos, recaudos y conciliación',
        status: { kind: 'available' },
        icon: 'credit',
        path: '/erp/cartera',
        permission: 'fin.receivable.read',
      },
      {
        id: 'hechos',
        name: 'Hechos económicos',
        description: 'Registro inmutable pendiente de contabilizar',
        status: { kind: 'available' },
        icon: 'accounting',
        path: '/erp/contabilidad/hechos',
        permission: 'cont.report.read',
      },
      {
        id: 'contabilidad',
        name: 'Contabilidad',
        description: 'Cuentas, asientos y períodos (capa bloqueada)',
        status: { kind: 'blocked', by: 'P-01 a P-04' },
        icon: 'accounting',
      },
    ],
  },
  {
    id: 'administracion',
    number: '08',
    name: 'Administración',
    description: 'Usuarios, roles y sedes.',
    path: '/erp/seccion/administracion',
    icon: 'admin',
    permission: 'adm.user.read',
    modules: [
      {
        id: 'usuarios',
        name: 'Usuarios y permisos',
        description: 'Usuarios, roles y sedes (matriz de permisos provisional)',
        status: { kind: 'available' },
        icon: 'users',
        path: '/erp/usuarios',
        permission: 'adm.user.read',
      },
    ],
  },
  {
    id: 'ia',
    number: '05',
    name: 'Actividad de IA',
    description: 'Lo que hace el asistente, siempre con confirmación humana.',
    path: '/erp/seccion/ia',
    icon: 'ai',
    modules: [
      {
        id: 'asistente',
        name: 'Asistente de IA',
        description: 'Consultas, tickets, consumo y preparación con confirmación',
        status: { kind: 'available' },
        icon: 'ai',
        path: '/erp/ia/asistente',
        permission: 'ia.query',
      },
    ],
  },
];

/** Agrupación visual de la barra lateral. */
export const SIDEBAR_GROUPS: { id: string; label: string; sectionIds: string[] }[] = [
  { id: 'general', label: 'General', sectionIds: ['inicio'] },
  { id: 'operaciones', label: 'Operaciones', sectionIds: ['pos', 'produccion', 'reparto', 'compras'] },
  { id: 'gestion', label: 'Gestión', sectionIds: ['dinero'] },
  { id: 'sistema', label: 'Sistema', sectionIds: ['administracion', 'ia'] },
];

/** Sección a la que pertenece una ruta del ERP (para marcar el elemento activo). */
export function sectionForPath(pathname: string): Section | undefined {
  if (pathname === '/erp' || pathname === '/erp/') return SECTIONS[0];
  return SECTIONS.find(
    (s) =>
      s.id !== 'inicio' &&
      (pathname.startsWith(s.path) || s.modules.some((m) => m.path && pathname.startsWith(m.path))),
  );
}

/** Migas de pan: sección y, cuando aplica, módulo o ficha concreta. */
export function breadcrumbsFor(pathname: string): { label: string; to?: string }[] {
  const section = sectionForPath(pathname);
  if (!section) return [{ label: 'Command Center', to: '/erp' }];
  if (section.id === 'inicio') return [{ label: 'Command Center' }];
  const module = section.modules.find((m) => m.path && pathname.startsWith(m.path));
  if (!module) return [{ label: section.name }];
  const modulePath = module.path;
  if (!modulePath) return [{ label: section.name }];
  const deeper = pathname.startsWith(`${modulePath}/`);
  return [
    { label: section.name, to: section.path },
    deeper ? { label: module.name, to: modulePath } : { label: module.name },
    ...(deeper ? [{ label: 'Detalle' }] : []),
  ];
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

/** Secciones que la barra lateral puede mostrarle a este usuario. */
export function visibleSections(me: MeResponse): Section[] {
  return SECTIONS.filter((s) => !s.permission || hasPermission(me, s.permission));
}

/** Área funcional a la que pertenece una sección (para el contexto de pantalla). */
export function areaLabelForSection(id: string): string {
  return SIDEBAR_GROUPS.find((group) => group.sectionIds.includes(id))?.label ?? 'ERP';
}
