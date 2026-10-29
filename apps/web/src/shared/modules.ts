/**
 * Catálogo de módulos del ERP con su estado real de construcción.
 * Se actualiza al terminar cada funcionalidad vertical (docs/PROJECT-STATUS.md).
 */
export type ModuleStatus = { kind: 'available' } | { kind: 'pending' } | { kind: 'blocked'; by: string };

export interface ModuleEntry {
  id: string;
  name: string;
  description: string;
  status: ModuleStatus;
}

export interface ModuleGroup {
  process: string;
  modules: ModuleEntry[];
}

const pending: ModuleStatus = { kind: 'pending' };

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    process: 'Abastecimiento',
    modules: [
      {
        id: 'compras',
        name: 'Compras y recepción',
        description: 'Proveedores, compras y lotes de materia prima',
        status: pending,
      },
    ],
  },
  {
    process: 'Producción',
    modules: [
      {
        id: 'produccion',
        name: 'Órdenes de producción',
        description: 'Recetas, consumo real, lotes y rendimiento',
        status: pending,
      },
    ],
  },
  {
    process: 'Inventario',
    modules: [
      {
        id: 'existencias',
        name: 'Existencias y traslados',
        description: 'Lotes, vencimientos, FEFO y trazabilidad',
        status: pending,
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
    process: 'Ventas y reparto',
    modules: [
      {
        id: 'pedidos',
        name: 'Clientes y pedidos',
        description: 'Pedidos, crédito y pendientes',
        status: pending,
      },
      {
        id: 'despachos',
        name: 'Despachos y entregas',
        description: 'Asignación, entregas parciales y devoluciones',
        status: pending,
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
    process: 'Dinero',
    modules: [
      {
        id: 'cartera',
        name: 'Cartera y recaudos',
        description: 'Cupos, abonos y conciliación',
        status: pending,
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
    process: 'Administración',
    modules: [
      {
        id: 'usuarios',
        name: 'Usuarios y permisos',
        description: 'Roles, sedes, aprobaciones y auditoría',
        status: { kind: 'blocked', by: 'Q-B-01' },
      },
    ],
  },
];

export function statusLabel(status: ModuleStatus): string {
  switch (status.kind) {
    case 'available':
      return 'Disponible';
    case 'pending':
      return 'En construcción';
    case 'blocked':
      return `Espera decisión ${status.by}`;
  }
}
