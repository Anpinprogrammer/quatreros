import {
  DISPATCH_STATUS_LABELS,
  PRODUCTION_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_LABELS,
  type DispatchStatus,
  type InventorySummary,
  type MeResponse,
  type ProductionOrderStatus,
  type ProductionOrderSummary,
  type SalesOrderStatus,
  type SalesOrderSummary,
} from '@quatreros/contracts';
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CalendarDays,
  Calculator,
  ClipboardList,
  CreditCard,
  Factory,
  Lock,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { hasPermission } from '../../lib/session';
import { useInventorySummary, useLots } from '../../services/existencias';
import {
  formatDate as formatInventoryDate,
  formatQuantity as formatInventoryQuantity,
} from '../../lib/format/existencias';
import { useOrders as useProductionOrders } from '../../services/produccion';
import { formatQuantity as formatProductionQuantity } from '../../lib/format/produccion';
import { useDispatches, useOrders as useSalesOrders } from '../../services/ventas';
import { formatMoney } from '../../lib/format/ventas';
import { Badge, StatusBadge, type BadgeTone } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ModuleIcon } from '../../components/ui/ModuleIcon';
import { PageHeader } from '../../components/ui/PageHeader';
import { isUsable, SECTIONS, type ModuleEntry } from '../../config/modules';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const TABS = [
  { id: 'modules', label: 'Módulos' },
  { id: 'board', label: 'Tablero del día' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const allModules = SECTIONS.flatMap((section) => section.modules);

const MODULE_TABS = [
  { id: 'catalogo', path: '/erp/catalogo' },
  { id: 'ordenes', path: '/erp/produccion' },
  { id: 'existencias', path: '/erp/existencias' },
  { id: 'pedidos', path: '/erp/ventas?tab=orders' },
  { id: 'despachos', path: '/erp/ventas?tab=dispatches' },
  { id: 'compras', path: '/erp/compras' },
  { id: 'usuarios', path: '/erp/usuarios' },
] as const;

const salesTones: Record<SalesOrderStatus, BadgeTone> = {
  confirmed: 'info',
  in_dispatch: 'warning',
  partially_delivered: 'warning',
  delivered: 'success',
};

const productionTones: Record<ProductionOrderStatus, BadgeTone> = {
  planned: 'warning',
  in_progress: 'info',
  closed: 'success',
};

const dispatchTones: Record<DispatchStatus, BadgeTone> = {
  prepared: 'info',
  in_route: 'warning',
  to_settle: 'success',
};

type PanelProps = {
  children: ReactNode;
  className?: string;
};

function Panel({ children, className = '' }: PanelProps) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h3 className="font-display text-card font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ListSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" className="space-y-2 p-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden className="h-12 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  );
}

function InlineEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-4 py-4">
      <p className="text-body font-semibold text-ink">{title}</p>
      {description ? <p className="mt-0.5 text-caption text-ink-2">{description}</p> : null}
    </div>
  );
}

function countLabel(count: number, hasMore: boolean) {
  return `${String(count)}${hasMore ? '+' : ''}`;
}

type KpiTone = 'brand' | 'info' | 'warning' | 'success' | 'neutral';

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  to,
  loading = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: KpiTone;
  to?: string;
  loading?: boolean;
}) {
  const iconTone = {
    brand: 'bg-brand-soft text-brand-ink',
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
    neutral: 'bg-surface-2 text-ink-2',
  }[tone];

  const content = (
    <Panel
      className={`h-full p-3.5 transition-[border-color,box-shadow,transform] duration-200 ${
        to
          ? 'group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-float motion-reduce:transform-none'
          : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-2 uppercase">{label}</p>
            {to ? (
              <ArrowUpRight
                aria-hidden
                className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-brand-ink"
              />
            ) : null}
          </div>
          {loading ? (
            <>
              <span aria-hidden className="mt-1.5 block h-7 w-12 animate-pulse rounded-lg bg-surface-3" />
              <span className="sr-only">Consultando {label}</span>
            </>
          ) : (
            <p className="tabular mt-0.5 font-display text-[1.5rem] leading-7 font-bold text-ink">{value}</p>
          )}
          <p className="mt-0.5 text-[11px] leading-4 text-ink-2">{loading ? 'Consultando…' : hint}</p>
        </div>
      </div>
    </Panel>
  );

  if (!to) return content;
  return (
    <Link to={to} className="group block h-full rounded-2xl focus-visible:outline-offset-4">
      {content}
    </Link>
  );
}

function ModuleAccessCard({ module, path, usable }: { module: ModuleEntry; path: string; usable: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className={`grid size-9 place-items-center rounded-xl ${
            usable ? 'bg-brand-soft text-brand-ink' : 'bg-surface-2 text-ink-2'
          }`}
        >
          <ModuleIcon name={module.icon} className="size-4" />
        </span>
        {usable ? (
          <Badge tone="success">
            <span aria-hidden className="size-1.5 rounded-full bg-success" />
            Disponible
          </Badge>
        ) : (
          <StatusBadge status={module.status} />
        )}
      </div>
      <h3 className="mt-2.5 font-display text-[15px] leading-5 font-semibold text-ink">{module.name}</h3>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-ink-2">{module.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <span className="text-[11px] font-medium text-ink-3">
          {usable ? 'Abrir módulo' : 'No disponible'}
        </span>
        <span
          aria-hidden
          className={`grid size-7 place-items-center rounded-full border ${
            usable ? 'border-brand/20 bg-brand-soft text-brand-ink' : 'border-line bg-surface-2 text-ink-3'
          }`}
        >
          {usable ? <ArrowUpRight className="size-3.5" /> : <Lock className="size-3" />}
        </span>
      </div>
    </>
  );

  if (usable) {
    return (
      <Link to={path} className="group block h-full rounded-2xl focus-visible:outline-offset-4">
        <Panel className="flex h-full flex-col p-3.5 transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-float motion-reduce:transform-none">
          {body}
        </Panel>
      </Link>
    );
  }

  return <Panel className="flex h-full flex-col p-3.5">{body}</Panel>;
}

function ModulesTab({ me }: { me: MeResponse }) {
  const items = MODULE_TABS.map((config) => {
    const module = allModules.find((entry) => entry.id === config.id);
    if (!module) return null;
    const usable = isUsable(module, me);
    if (!usable && module.status.kind === 'available') return null;
    return { module, path: config.path, usable };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-body text-ink-2">Accede a las áreas disponibles para tu rol.</p>
        <span className="text-caption text-ink-3">
          {items.length} {items.length === 1 ? 'módulo' : 'módulos'}
        </span>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Tu rol aún no tiene módulos operativos"
          description="Cuando tu administrador te asigne permisos, los accesos aparecerán aquí."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.module.id}>
              <ModuleAccessCard module={item.module} path={item.path} usable={item.usable} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentOrdersCard({
  orders,
  pending,
  error,
  canRead,
}: {
  orders: SalesOrderSummary[];
  pending: boolean;
  error: boolean;
  canRead: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Pedidos recientes"
        description="Últimos pedidos de tus sedes."
        action={
          canRead ? (
            <Link
              to="/erp/ventas?tab=orders"
              className="inline-flex min-h-8 items-center gap-1 text-caption font-semibold text-brand-ink hover:text-ink"
            >
              Ver todos <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          ) : null
        }
      />
      {!canRead ? (
        <InlineEmpty
          title="Requiere permiso de pedidos"
          description="Tu rol no consulta pedidos; pide acceso a un administrador."
        />
      ) : pending ? (
        <ListSkeleton rows={2} label="Cargando pedidos recientes…" />
      ) : error ? (
        <p role="alert" className="px-4 py-5 text-body text-danger">
          No fue posible consultar los pedidos recientes.
        </p>
      ) : orders.length === 0 ? (
        <InlineEmpty title="Sin pedidos registrados" />
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/erp/ventas/pedidos/${order.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-caption font-semibold text-brand-ink">
                      {order.number}
                    </span>
                    <Badge tone={salesTones[order.status]}>{SALES_ORDER_STATUS_LABELS[order.status]}</Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-body font-semibold text-ink">
                    {order.customerName}
                  </span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {order.siteName} · {order.lineCount} {order.lineCount === 1 ? 'línea' : 'líneas'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block font-mono text-body font-semibold text-ink">
                    {formatMoney(order.total)}
                  </span>
                  <span className="block text-[11px] text-ink-3">
                    {order.paymentMode === 'credit' ? 'Crédito' : 'Contraentrega'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ActiveProductionCard({
  orders,
  pending,
  error,
  canRead,
}: {
  orders: ProductionOrderSummary[];
  pending: boolean;
  error: boolean;
  canRead: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Producción y mermas"
        description="Órdenes activas. Mermas de cocina: espera decisión P-07."
        action={
          canRead ? (
            <Link
              to="/erp/produccion"
              className="inline-flex min-h-8 items-center gap-1 text-caption font-semibold text-brand-ink hover:text-ink"
            >
              Ver órdenes <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          ) : null
        }
      />
      {!canRead ? (
        <InlineEmpty
          title="Requiere permiso de producción"
          description="Tu rol no consulta órdenes de producción."
        />
      ) : pending ? (
        <ListSkeleton rows={2} label="Cargando producción activa…" />
      ) : error ? (
        <p role="alert" className="px-4 py-5 text-body text-danger">
          No fue posible consultar la producción.
        </p>
      ) : orders.length === 0 ? (
        <InlineEmpty title="Sin órdenes activas" />
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/erp/produccion/${order.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-caption font-semibold text-brand-ink">
                      {order.number}
                    </span>
                    <Badge tone={productionTones[order.status]}>
                      {PRODUCTION_ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-body font-semibold text-ink">
                    {order.productName}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block font-mono text-caption text-ink">
                    Plan: {formatProductionQuantity(order.plannedQty)}
                  </span>
                  <span className="block text-[11px] text-ink-3">{order.siteName}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CapabilityTile({ icon: Icon, title, status }: { icon: LucideIcon; title: string; status: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-2 py-1.5" title={`${title}: ${status}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
        <Icon aria-hidden className="size-3.5 shrink-0 text-ink-3" />
        <span className="truncate">{title}</span>
      </p>
      <p className="mt-0.5 pl-5 text-[10px] text-ink-3">{status}</p>
    </div>
  );
}

function BoardTab({ me }: { me: MeResponse }) {
  const canSales = hasPermission(me, 'com.order.read');
  const canProduction = hasPermission(me, 'prod.order.read');
  const canInventory = hasPermission(me, 'inv.stock.read');
  const canDispatch = hasPermission(me, 'dis.dispatch.read');

  const salesOrders = useSalesOrders({ limit: 100 }, { enabled: canSales });
  const productionOrders = useProductionOrders({ limit: 100 }, { enabled: canProduction });
  const inventory = useInventorySummary({ enabled: canInventory });

  const expiresBefore = new Date();
  expiresBefore.setDate(expiresBefore.getDate() + 7);
  const lots = useLots(
    { status: 'available', expiresBefore: expiresBefore.toISOString().slice(0, 10), limit: 3 },
    { enabled: canInventory },
  );
  const dispatches = useDispatches({ limit: 10 }, { enabled: canDispatch });

  const sales = salesOrders.data?.data ?? [];
  const activeSales = sales.filter((order) => order.status !== 'delivered');
  const confirmedSales = activeSales.filter((order) => order.status === 'confirmed').length;
  const inDispatchSales = activeSales.filter((order) => order.status === 'in_dispatch').length;
  const partialSales = activeSales.filter((order) => order.status === 'partially_delivered').length;
  const salesBreakdown = [
    confirmedSales > 0
      ? `${String(confirmedSales)} ${confirmedSales === 1 ? 'confirmado' : 'confirmados'}`
      : null,
    inDispatchSales > 0 ? `${String(inDispatchSales)} en despacho` : null,
    partialSales > 0 ? `${String(partialSales)} ${partialSales === 1 ? 'parcial' : 'parciales'}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  const production = productionOrders.data?.data ?? [];
  const activeProduction = production.filter((order) => order.status !== 'closed');
  const plannedProduction = activeProduction.filter((order) => order.status === 'planned').length;
  const inProgressProduction = activeProduction.filter((order) => order.status === 'in_progress').length;

  const allPendingDispatches = (dispatches.data?.data ?? []).filter(
    (dispatch) => dispatch.status !== 'to_settle',
  );
  const pendingDispatches = allPendingDispatches.slice(0, 3);
  const expiringLots = lots.data?.data ?? [];
  const inventorySummary: InventorySummary | undefined = inventory.data;

  const salesHint = !canSales
    ? 'Requiere permiso de pedidos'
    : salesOrders.isPending
      ? 'Consultando pedidos…'
      : salesOrders.error
        ? 'No fue posible consultar'
        : activeSales.length === 0
          ? 'Sin pedidos activos'
          : salesBreakdown || 'Pedidos en curso';

  const productionHint = !canProduction
    ? 'Requiere permiso de producción'
    : productionOrders.isPending
      ? 'Consultando órdenes…'
      : productionOrders.error
        ? 'No fue posible consultar'
        : activeProduction.length === 0
          ? 'Sin órdenes activas'
          : `${String(plannedProduction)} ${plannedProduction === 1 ? 'planificada' : 'planificadas'} · ${String(inProgressProduction)} en proceso`;

  const fefoValue = inventorySummary ? String(inventorySummary.lotsNearExpiry) : '—';
  const fefoHint = !canInventory
    ? 'Requiere permiso de existencias'
    : inventory.isPending
      ? 'Consultando inventario…'
      : inventory.error
        ? 'No fue posible consultar'
        : inventorySummary && inventorySummary.expiredLots > 0
          ? `${String(inventorySummary.expiredLots)} vencidos · ${String(inventorySummary.lotsNearExpiry)} por vencer`
          : inventorySummary && inventorySummary.lotsNearExpiry > 0
            ? 'Vencen en los próximos 7 días'
            : 'Sin vencimientos próximos';

  const attentionCount =
    (inventorySummary?.lotsNearExpiry ?? 0) + (dispatches.data ? allPendingDispatches.length : 0);
  const attentionReady = canInventory || canDispatch;
  const attentionError =
    (canInventory && Boolean(inventory.error)) || (canDispatch && Boolean(dispatches.error));
  const attentionBadge = !attentionReady
    ? { tone: 'neutral' as const, text: 'Sin alcance' }
    : attentionError
      ? { tone: 'neutral' as const, text: 'No disponible' }
      : (canInventory && inventory.isPending) || (canDispatch && dispatches.isPending)
        ? { tone: 'neutral' as const, text: 'Consultando…' }
        : attentionCount > 0
          ? { tone: 'warning' as const, text: `${String(attentionCount)} por revisar` }
          : { tone: 'success' as const, text: 'Sin alertas' };

  return (
    <div className="space-y-4">
      <section aria-label="Indicadores del día" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ventas del día"
          value="—"
          hint="Sin datos de caja para hoy."
          icon={Calculator}
          tone="neutral"
        />
        <KpiCard
          label="Pedidos activos"
          value={
            salesOrders.data ? countLabel(activeSales.length, Boolean(salesOrders.data.page.nextCursor)) : '—'
          }
          hint={salesHint}
          icon={ClipboardList}
          tone="info"
          {...(canSales ? { to: '/erp/ventas?tab=orders' } : {})}
          loading={canSales && salesOrders.isPending}
        />
        <KpiCard
          label="Producción activa"
          value={
            productionOrders.data
              ? countLabel(activeProduction.length, Boolean(productionOrders.data.page.nextCursor))
              : '—'
          }
          hint={productionHint}
          icon={Factory}
          tone="brand"
          {...(canProduction ? { to: '/erp/produccion' } : {})}
          loading={canProduction && productionOrders.isPending}
        />
        <KpiCard
          label="Alertas FEFO"
          value={fefoValue}
          hint={fefoHint}
          icon={CalendarClock}
          tone={
            inventorySummary && inventorySummary.expiredLots > 0
              ? 'warning'
              : inventorySummary && inventorySummary.lotsNearExpiry > 0
                ? 'warning'
                : inventorySummary
                  ? 'success'
                  : 'neutral'
          }
          {...(canInventory ? { to: '/erp/existencias' } : {})}
          loading={canInventory && inventory.isPending}
        />
      </section>

      <section aria-label="Operación">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-3">
            <RecentOrdersCard
              orders={sales.slice(0, 3)}
              pending={salesOrders.isPending}
              error={Boolean(salesOrders.error)}
              canRead={canSales}
            />
            <ActiveProductionCard
              orders={activeProduction.slice(0, 3)}
              pending={productionOrders.isPending}
              error={Boolean(productionOrders.error)}
              canRead={canProduction}
            />
          </div>

          <Panel className="h-full">
            <PanelHeader
              title="Atención requerida"
              description="Prioridades de tus sedes."
              action={<Badge tone={attentionBadge.tone}>{attentionBadge.text}</Badge>}
            />

            <section aria-labelledby="atencion-fefo" className="border-b border-line p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h4 id="atencion-fefo" className="flex items-center gap-2 text-body font-semibold text-ink">
                  <CalendarClock aria-hidden className="size-4 text-warning" />
                  Lotes por vencer
                </h4>
                {inventorySummary ? (
                  <span className="font-mono text-caption text-ink-2">
                    {String(inventorySummary.lotsNearExpiry)}
                  </span>
                ) : null}
              </div>

              {!canInventory ? (
                <p className="mt-2 text-caption text-ink-2">Requiere permiso de existencias.</p>
              ) : lots.isPending ? (
                <p className="mt-2 text-caption text-ink-2">Consultando lotes…</p>
              ) : lots.error ? (
                <p role="alert" className="mt-2 text-caption text-danger">
                  No fue posible consultar los lotes.
                </p>
              ) : expiringLots.length === 0 ? (
                <p className="mt-2 text-caption text-ink-2">Sin lotes por vencer en 7 días.</p>
              ) : (
                <ul className="mt-2.5 space-y-1.5">
                  {expiringLots.map((lot) => (
                    <li key={lot.id}>
                      <Link
                        to={`/erp/existencias/lotes/${lot.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2 transition-colors hover:border-brand/40 hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[11px] font-semibold text-brand-ink">
                            {lot.code}
                          </span>
                          <span className="block truncate text-caption font-semibold text-ink">
                            {lot.itemName}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[11px] text-ink-2">
                            {formatInventoryDate(lot.expiresOn)}
                          </span>
                          <span className="block text-[11px] text-ink-3">
                            {formatInventoryQuantity(lot.totalQuantity)} {lot.baseUnit}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="atencion-despachos" className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h4
                  id="atencion-despachos"
                  className="flex items-center gap-2 text-body font-semibold text-ink"
                >
                  <Truck aria-hidden className="size-4 text-info" />
                  Estado de reparto
                </h4>
                {canDispatch && dispatches.data ? (
                  <span className="font-mono text-caption text-ink-2">
                    {String(allPendingDispatches.length)}
                  </span>
                ) : null}
              </div>

              {!canDispatch ? (
                <p className="mt-2 text-caption text-ink-2">Requiere permiso de despachos.</p>
              ) : dispatches.isPending ? (
                <p className="mt-2 text-caption text-ink-2">Consultando despachos…</p>
              ) : dispatches.error ? (
                <p role="alert" className="mt-2 text-caption text-danger">
                  No fue posible consultar los despachos.
                </p>
              ) : pendingDispatches.length === 0 ? (
                <p className="mt-2 text-caption text-ink-2">Sin despachos preparados o en ruta.</p>
              ) : (
                <ul className="mt-2.5 space-y-1.5">
                  {pendingDispatches.map((dispatch) => (
                    <li key={dispatch.id}>
                      <Link
                        to={`/erp/ventas/despachos/${dispatch.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2 transition-colors hover:border-brand/40 hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[11px] font-semibold text-brand-ink">
                            {dispatch.number}
                          </span>
                          <span className="block truncate text-[11px] text-ink-2">
                            {dispatch.driverName} · {dispatch.orderCount}{' '}
                            {dispatch.orderCount === 1 ? 'pedido' : 'pedidos'}
                          </span>
                        </span>
                        <Badge tone={dispatchTones[dispatch.status]}>
                          {DISPATCH_STATUS_LABELS[dispatch.status]}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="otras-areas" className="border-t border-line p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h4 id="otras-areas" className="text-body font-semibold text-ink">
                  Otras áreas
                </h4>
                <span className="text-[10px] text-ink-3">Disponibilidad</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <CapabilityTile icon={Wallet} title="Caja POS" status="Sin datos" />
                <CapabilityTile icon={CreditCard} title="Crédito y cartera" status="No disponible" />
                <CapabilityTile icon={ShieldCheck} title="Aprobaciones" status="No disponible" />
                <CapabilityTile icon={Sparkles} title="Sugerencia de IA" status="Sin conexión" />
              </div>
            </section>
          </Panel>
        </div>
      </section>
    </div>
  );
}

export function CommandCenter({ me }: { me: MeResponse }) {
  useDocumentTitle('Command Center');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = requestedTab === 'board' ? 'board' : 'modules';
  const firstName = me.user.fullName.split(' ')[0] ?? me.user.fullName;
  const today = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const scope =
    me.sites.length === 0
      ? 'Sin sede asignada'
      : me.sites.length === 1
        ? (me.sites[0]?.name ?? '1 sede autorizada')
        : `${String(me.sites.length)} sedes autorizadas`;

  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'modules') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    const next = TABS[nextIndex];
    if (!next) return;
    selectTab(next.id);
    requestAnimationFrame(() => document.getElementById(`command-tab-${next.id}`)?.focus());
  };

  const canInventory = hasPermission(me, 'inv.stock.read');
  const canSales = hasPermission(me, 'com.order.read');

  return (
    <section aria-labelledby="inicio-titulo" className="space-y-4">
      <PageHeader
        titleId="inicio-titulo"
        title="Command Center"
        description="Todo lo que sucede en tu negocio, en un solo lugar."
        actions={
          canInventory ? (
            <Link
              to="/erp/existencias"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-body font-semibold text-ink transition-colors hover:border-ink-3 hover:bg-surface-2"
            >
              <Boxes aria-hidden className="size-4" />
              Ver existencias
            </Link>
          ) : canSales ? (
            <Link
              to="/erp/ventas?tab=orders"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-body font-semibold text-ink transition-colors hover:border-ink-3 hover:bg-surface-2"
            >
              <ClipboardList aria-hidden className="size-4" />
              Ver pedidos
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Vistas del Command Center"
          className="inline-flex rounded-xl border border-line bg-surface-2 p-1"
        >
          {TABS.map((item, index) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                id={`command-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`command-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  selectTab(item.id);
                }}
                onKeyDown={(event) => {
                  onTabKeyDown(event, index);
                }}
                className={`min-h-9 rounded-lg px-4 text-body font-semibold transition-colors duration-200 ${
                  selected
                    ? 'bg-brand-soft text-brand-ink shadow-sm'
                    : 'text-ink-2 hover:bg-surface hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-ink-2">
          <span>Hola, {firstName}</span>
          <span aria-hidden>·</span>
          <CalendarDays aria-hidden className="size-3.5 text-brand-ink" />
          <span className="first-letter:uppercase">{today}</span>
          <span aria-hidden>·</span>
          <span>{scope}</span>
        </p>
      </div>

      <div
        key={tab}
        id={`command-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`command-tab-${tab}`}
        tabIndex={0}
        className="animate-fade-in outline-none"
      >
        {tab === 'modules' ? <ModulesTab me={me} /> : <BoardTab me={me} />}
      </div>
    </section>
  );
}
