import type { MeResponse } from '@quatreros/contracts';
import {
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Factory,
  Layers,
  LockKeyhole,
  Package,
  PackageOpen,
  Snowflake,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router';
import { useProducts } from '../../services/catalogo';
import { useInventorySummary } from '../../services/existencias';
import { useOrders } from '../../services/produccion';
import { formatMoney } from '../../lib/format/catalogo';
import { hasPermission } from '../../lib/session';
import { SECTIONS } from '../../config/modules';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ModuleIcon } from '../../components/ui/ModuleIcon';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const section = SECTIONS.find((s) => s.id === 'produccion');

/**
 * Pantalla de Producción (RF-030, DEC-091, DEC-093).
 * Muestra datos reales del catálogo y estados vacíos honestos para lo que aún no existe.
 * No inventa órdenes, lotes ni existencias: cada tarjeta dice qué entrega la activa.
 */
export function ProductionPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Producción');
  const canCatalog = hasPermission(me, 'cat.product.read');
  const canInventory = hasPermission(me, 'inv.stock.read');
  const canProduction = hasPermission(me, 'prod.order.read');
  const products = useProducts({ status: 'active' }, { enabled: canCatalog });
  const inventory = useInventorySummary({ enabled: canInventory });
  const orders = useOrders({ limit: 100 }, { enabled: canProduction });
  const list = products.data?.data ?? [];
  const activeCount = products.data
    ? `${String(list.length)}${products.data.page.nextCursor ? '+' : ''}`
    : '—';
  const activeHint = !canCatalog
    ? 'Requiere permiso de catálogo'
    : products.isPending
      ? 'Consultando el catálogo…'
      : products.error
        ? 'No fue posible consultar el catálogo'
        : 'Productos activos en el catálogo';
  const orderCount = orders.data
    ? `${String(orders.data.data.length)}${orders.data.page.nextCursor ? '+' : ''}`
    : '—';
  const ordersHint = !canProduction
    ? 'Requiere permiso de producción'
    : orders.isPending
      ? 'Consultando órdenes…'
      : orders.error
        ? 'No fue posible consultar las órdenes'
        : 'Órdenes registradas';
  const ordersCaption = !canProduction
    ? 'Tu rol puede ver la sección, pero las órdenes requieren el permiso prod.order.read.'
    : orders.isPending
      ? 'Consultando órdenes registradas…'
      : `Órdenes registradas: ${orderCount}. Abre la pantalla para planificar, consumir por FEFO y cerrar el lote.`;

  return (
    <section aria-labelledby="produccion-titulo" className="space-y-8">
      <PageHeader
        titleId="produccion-titulo"
        eyebrow={
          <>
            <ModuleIcon name="production" className="size-3.5" />
            <span>{section?.number} · Operaciones</span>
          </>
        }
        title="Producción"
        description="Gestiona tus productos, órdenes y existencias desde un solo lugar."
        actions={
          canProduction ? (
            <Link
              to="/erp/produccion"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-action font-bold text-white shadow-brand transition-colors duration-200 hover:bg-brand-hover"
            >
              Abrir órdenes
              <ArrowUpRight aria-hidden className="size-5" />
            </Link>
          ) : canCatalog ? (
            <Link
              to="/erp/catalogo"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-action font-bold text-white shadow-brand transition-colors duration-200 hover:bg-brand-hover"
            >
              Abrir catálogo
              <ArrowUpRight aria-hidden className="size-5" />
            </Link>
          ) : (
            <Badge tone="neutral">Tu rol no administra el catálogo</Badge>
          )
        }
      />

      <section aria-labelledby="resumen-produccion">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="resumen-produccion" className="font-display text-title font-bold text-ink">
            Resumen de operación
          </h2>
          <p className="text-caption text-ink-2">
            Los indicadores sin fuente real muestran “—” y explican qué los activa.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Productos activos"
            value={activeCount}
            hint={activeHint}
            tone={canCatalog ? 'brand' : 'neutral'}
            icon={<Package className="size-4" />}
          />
          <StatCard
            label="Órdenes de producción"
            value={orderCount}
            hint={ordersHint}
            tone={canProduction ? 'brand' : 'neutral'}
            icon={<Factory className="size-4" />}
          />
          <StatCard
            label="Lotes próximos a vencer"
            value={inventory.data ? String(inventory.data.lotsNearExpiry) : '—'}
            hint={canInventory ? 'Vencen en los próximos 7 días' : 'Requiere permiso de existencias'}
            tone={inventory.data && inventory.data.lotsNearExpiry > 0 ? 'warning' : 'neutral'}
            icon={<CalendarClock className="size-4" />}
          />
          <StatCard
            label="Lotes vencidos"
            value={inventory.data ? String(inventory.data.expiredLots) : '—'}
            hint={
              canInventory ? 'Excluidos de disponible; retiro según P-05' : 'Requiere permiso de existencias'
            }
            tone={inventory.data && inventory.data.expiredLots > 0 ? 'warning' : 'neutral'}
            icon={<TriangleAlert className="size-4" />}
          />
        </div>
      </section>

      <section aria-labelledby="modulos-produccion">
        <div className="mb-3">
          <h2 id="modulos-produccion" className="font-display text-title font-bold text-ink">
            Módulos de producción
          </h2>
          <p className="mt-1 text-body text-ink-2">
            Lo disponible se abre; lo pendiente se señala sin simular una operación.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Catálogo: módulo real y datos reales */}
          <Card className="flex flex-col lg:col-span-7">
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-ink"
              >
                <Package className="size-5" />
              </span>
              <Badge tone={canCatalog ? 'success' : 'neutral'}>
                {canCatalog ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-success" />
                    Disponible
                  </>
                ) : (
                  'Requiere permiso'
                )}
              </Badge>
            </div>
            <h3 className="mt-4 font-display text-title font-bold text-ink">
              {canCatalog ? (
                <Link to="/erp/catalogo" className="rounded transition-colors hover:text-brand-ink">
                  Catálogo y precios
                </Link>
              ) : (
                'Catálogo y precios'
              )}
            </h3>
            <p className="mt-1.5 text-body text-ink-2">
              Productos, presentaciones, materias primas y precio vigente con histórico auditado.
            </p>

            <div className="mt-5 flex-1">
              {!canCatalog ? (
                <EmptyState
                  compact
                  icon={<LockKeyhole className="size-5" />}
                  title="Sin acceso al catálogo"
                  description="Tu rol puede ver esta sección, pero el catálogo requiere el permiso cat.product.read."
                />
              ) : products.isPending ? (
                <div aria-hidden className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-2" />
                  ))}
                </div>
              ) : products.error ? (
                <EmptyState
                  compact
                  title="No fue posible cargar el catálogo"
                  description={products.error.message}
                />
              ) : list.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Package className="size-5" />}
                  title="El catálogo está vacío"
                  description="Crea el primer producto para empezar a vender."
                />
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {list.slice(0, 3).map((product) => {
                    const presentation = product.presentations.find((p) => p.currentPrice);
                    return (
                      <li key={product.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                        <span className="min-w-0">
                          <span className="block truncate text-body font-semibold text-ink">
                            {product.name}
                          </span>
                          <span className="block truncate text-caption text-ink-2">
                            {product.presentations.length === 0
                              ? 'Sin presentaciones'
                              : `${String(product.presentations.length)} ${product.presentations.length === 1 ? 'presentación' : 'presentaciones'}`}
                          </span>
                        </span>
                        {presentation?.currentPrice ? (
                          <span className="tabular shrink-0 font-mono text-body text-ink">
                            {formatMoney(presentation.currentPrice)}
                          </span>
                        ) : (
                          <Badge tone="warning">Sin precio</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {canCatalog ? (
              <Link
                to="/erp/catalogo"
                className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-brand-ink hover:text-ink"
              >
                Ver catálogo completo
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            ) : null}
          </Card>

          {/* Órdenes: módulo real, con acceso directo */}
          <Card className="flex flex-col lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-ink"
              >
                <Factory className="size-5" />
              </span>
              <Badge tone={canProduction ? 'success' : 'neutral'}>
                {canProduction ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-success" />
                    Disponible
                  </>
                ) : (
                  'Requiere permiso'
                )}
              </Badge>
            </div>
            <h3 className="mt-4 font-display text-title font-bold text-ink">
              {canProduction ? (
                <Link to="/erp/produccion" className="rounded transition-colors hover:text-brand-ink">
                  Órdenes de producción
                </Link>
              ) : (
                'Órdenes de producción'
              )}
            </h3>
            <p className="mt-1.5 text-body text-ink-2">
              Recetas, consumo real por lote y rendimiento de fabricación.
            </p>
            <ol className="mt-5 space-y-3">
              {[
                ['Definir receta y lote objetivo', 'Cantidades exactas por producto'],
                ['Consumir insumos por FEFO', 'Salida de materia prima con trazabilidad'],
                ['Registrar rendimiento', 'Peso real, merma y vencimiento del lote'],
              ].map(([title, detail], index) => (
                <li key={title} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-mono text-[11px] font-semibold text-ink-2"
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-body font-semibold text-ink">{title}</span>
                    <span className="block text-caption text-ink-2">{detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-auto flex flex-col gap-3 pt-5">
              <p className="text-caption text-ink-3">{ordersCaption}</p>
              {orders.error ? <p className="text-caption text-danger">{orders.error.message}</p> : null}
              {canProduction ? (
                <Link
                  to="/erp/produccion"
                  className="inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-brand-ink hover:text-ink"
                >
                  Abrir órdenes
                  <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </div>
          </Card>

          {/* Existencias: módulo real, con acceso directo */}
          <Card className="flex flex-col lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-ink"
              >
                <Boxes className="size-5" />
              </span>
              <Badge tone={canInventory ? 'success' : 'neutral'}>
                {canInventory ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-success" />
                    Disponible
                  </>
                ) : (
                  'Requiere permiso'
                )}
              </Badge>
            </div>
            <h3 className="mt-4 font-display text-title font-bold text-ink">
              {canInventory ? (
                <Link to="/erp/existencias" className="rounded transition-colors hover:text-brand-ink">
                  Existencias y traslados
                </Link>
              ) : (
                'Existencias y traslados'
              )}
            </h3>
            <p className="mt-1.5 text-body text-ink-2">
              Saldos por ubicación, lotes con vencimiento y salida preferente FEFO.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: <Layers className="size-3.5" />, label: 'Lotes' },
                { icon: <Snowflake className="size-3.5" />, label: 'Vencimientos' },
                { icon: <CalendarClock className="size-3.5" />, label: 'FEFO' },
                { icon: <Boxes className="size-3.5" />, label: 'Traslados' },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink-2"
                >
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-3 pt-5">
              <p className="text-caption text-ink-3">
                {canInventory
                  ? 'Saldos, lotes, vencimientos, kardex, traslados y trazabilidad con datos reales.'
                  : 'Tu rol puede ver la sección, pero las existencias requieren el permiso inv.stock.read.'}
              </p>
              {canInventory ? (
                <Link
                  to="/erp/existencias"
                  className="inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-brand-ink hover:text-ink"
                >
                  Abrir existencias
                  <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </div>
          </Card>

          {/* Paquetes: decisión pendiente, explicada */}
          <Card className="flex flex-col border-warning/30 lg:col-span-7">
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid size-11 place-items-center rounded-2xl bg-warning/10 text-warning"
              >
                <PackageOpen className="size-5" />
              </span>
              <Badge tone="warning">Espera decisión P-06</Badge>
            </div>
            <h3 className="mt-4 font-display text-title font-bold text-ink">Apertura de paquetes</h3>
            <p className="mt-1.5 max-w-2xl text-body text-ink-2">
              Convertir un paquete en unidades individuales cambia el inventario por presentación. La mecánica
              exacta de conversión (P-06) todavía no está confirmada, así que la acción no se habilita.
            </p>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2/60 px-4 py-3">
              <LockKeyhole aria-hidden className="size-4 shrink-0 text-ink-3" />
              <p className="text-body text-ink-2">
                <span className="font-semibold text-ink">Abrir paquete</span> · disponible cuando el
                responsable confirme P-06.
              </p>
            </div>
            <p className="mt-auto pt-5 text-caption text-ink-3">
              No se simula el desglose ni se alteran existencias mientras la decisión siga abierta.
            </p>
          </Card>
        </div>
      </section>
    </section>
  );
}
