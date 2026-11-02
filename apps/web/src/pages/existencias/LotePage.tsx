import { ITEM_KIND_LABELS, type MeResponse } from '@quatreros/contracts';
import { CalendarClock, MapPin, Package, Warehouse } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { hasPermission } from '../../hooks/session';
import { Badge } from '../../components/ui/Badge';
import { Card, CardLabel } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { BalanceTable } from '../../components/existencias/BalanceTable';
import { useLot, useTraceability } from '../../services/existencias';
import { formatDate, formatQuantity } from '../../lib/format/existencias';
import { MovementTable } from '../../components/existencias/MovementTable';
import { LotStatusBadge } from '../../components/existencias/StatusBadge';

/** Ficha de lote: saldos, movimientos y trazabilidad (RF-110, RF-111, RF-118). */
export function LotePage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const lot = useLot(id);
  const canTrace = hasPermission(me, 'inv.traceability.read');
  const trace = useTraceability(id, canTrace);
  useDocumentTitle(lot.data ? `Lote ${lot.data.code}` : 'Lote');

  return (
    <section aria-labelledby="lote-titulo" className="space-y-8">
      <div>
        <Link
          to="/erp/existencias"
          className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
        >
          <span aria-hidden>‹</span> Existencias
        </Link>
      </div>

      {lot.isPending ? <LoadingSkeleton label="Cargando lote…" rows={2} /> : null}
      {lot.error ? <Alert>{lot.error.message}</Alert> : null}

      {lot.data ? (
        <>
          <PageHeader
            titleId="lote-titulo"
            title={`Lote ${lot.data.code}`}
            description={`${lot.data.itemName} · ${ITEM_KIND_LABELS[lot.data.itemKind]}`}
            meta={
              <>
                <LotStatusBadge status={lot.data.status} isExpired={lot.data.isExpired} />
                <Badge tone="neutral">{lot.data.lotType === 'finished_good' ? 'PT' : 'MP'}</Badge>
              </>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Saldo total"
              value={`${formatQuantity(lot.data.totalQuantity)} ${lot.data.baseUnit}`}
              hint="Suma de todas las ubicaciones"
              tone="brand"
              icon={<Package className="size-4" />}
            />
            <StatCard
              label="Vence"
              value={formatDate(lot.data.expiresOn)}
              hint={lot.data.isExpired ? 'Lote vencido: no cuenta como disponible' : 'Fecha de negocio'}
              tone={lot.data.isExpired ? 'warning' : 'neutral'}
              icon={<CalendarClock className="size-4" />}
            />
            <StatCard
              label="Fabricado"
              value={formatDate(lot.data.manufacturedOn)}
              hint={lot.data.manufacturedOn ? 'Fecha de producción' : 'Materia prima: la define la recepción'}
              icon={<Warehouse className="size-4" />}
            />
            <StatCard
              label="Ubicaciones"
              value={String(lot.data.balances.length)}
              hint="Con saldo registrado para este lote"
              icon={<MapPin className="size-4" />}
            />
          </div>

          <section aria-labelledby="lote-saldos" className="space-y-3">
            <h2 id="lote-saldos" className="font-display text-title font-bold text-ink">
              Saldos por ubicación
            </h2>
            {lot.data.balances.length === 0 ? (
              <EmptyState
                title="Sin saldos"
                description="Este lote no tiene existencias positivas en ninguna ubicación."
              />
            ) : (
              <BalanceTable balances={lot.data.balances} showLotLink={false} />
            )}
          </section>

          <section aria-labelledby="lote-movimientos" className="space-y-3">
            <h2 id="lote-movimientos" className="font-display text-title font-bold text-ink">
              Últimos movimientos
            </h2>
            {lot.data.movements.length === 0 ? (
              <EmptyState
                title="Sin movimientos"
                description="El kardex no registra movimientos para este lote."
              />
            ) : (
              <MovementTable movements={lot.data.movements} showLotLink={false} />
            )}
          </section>

          <section aria-labelledby="lote-trazabilidad" className="space-y-3">
            <h2 id="lote-trazabilidad" className="font-display text-title font-bold text-ink">
              Trazabilidad
            </h2>
            {!canTrace ? (
              <Alert tone="info">
                Tu rol no consulta trazabilidad de lote. El administrador, el manager, producción y
                contabilidad sí pueden hacerlo.
              </Alert>
            ) : null}
            {canTrace && trace.isPending ? <LoadingSkeleton label="Cargando trazabilidad…" rows={2} /> : null}
            {canTrace && trace.error ? <Alert>{trace.error.message}</Alert> : null}
            {canTrace && trace.data ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardLabel>Hacia atrás</CardLabel>
                  <p className="mt-2 text-body text-ink-2">
                    Materias primas y proveedores que originaron este lote.
                  </p>
                  {trace.data.backward.inputs.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {trace.data.backward.inputs.map((input) => (
                        <li
                          key={input.lotId}
                          className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0"
                        >
                          <span>
                            <span className="block font-semibold text-ink">{input.itemName}</span>
                            <span className="font-mono text-caption text-ink-2">{input.code}</span>
                          </span>
                          <span className="font-mono text-ink">{formatQuantity(input.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4">
                      <EmptyState
                        compact
                        title="Sin insumos registrados"
                        description={trace.data.backward.pending[0] ?? 'Se activa en una entrega posterior.'}
                      />
                    </div>
                  )}
                </Card>

                <Card>
                  <CardLabel>Hacia adelante</CardLabel>
                  <p className="mt-2 text-body text-ink-2">
                    Despachos y ventas que recibieron unidades de este lote.
                  </p>
                  {trace.data.forward.movements.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {trace.data.forward.movements.map((movement) => (
                        <li
                          key={movement.movementId}
                          className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0"
                        >
                          <span className="text-body">
                            {movement.sourceType} ·{' '}
                            <span className="font-mono text-ink">{movement.sourceId.slice(0, 8)}</span>
                          </span>
                          <span className="font-mono text-ink">{formatQuantity(movement.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4">
                      <EmptyState
                        compact
                        title="Sin despachos ni ventas"
                        description={trace.data.forward.pending[0] ?? 'Se activa en una entrega posterior.'}
                      />
                    </div>
                  )}
                </Card>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
