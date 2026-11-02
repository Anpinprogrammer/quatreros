import {
  DISPATCH_STATUS_LABELS,
  PAYMENT_MODE_LABELS,
  type DispatchStatus,
  type MeResponse,
} from '@quatreros/contracts';
import { ArrowLeft, CheckCircle2, PackageCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { hasPermission } from '../../shared/auth/session';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Card, CardLabel } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Alert, Button } from '../../shared/ui/form';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useDispatch, useInspectReturn, useLoadDispatch } from './api';
import { formatDate, formatMoney, formatQuantity } from './format';

const tones: Record<DispatchStatus, BadgeTone> = {
  prepared: 'info',
  in_route: 'warning',
  to_settle: 'success',
};

export function DispatchPage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const dispatch = useDispatch(id);
  const load = useLoadDispatch();
  const inspect = useInspectReturn();
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);
  useDocumentTitle(dispatch.data ? `Despacho ${dispatch.data.number}` : 'Despacho');
  const canLoad = hasPermission(me, 'dis.dispatch.create');
  const canInspect = hasPermission(me, 'dis.return.inspect');

  return (
    <section aria-labelledby="despacho-titulo" className="space-y-8">
      <Link
        to="/erp/ventas"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Ventas
      </Link>
      {dispatch.isPending ? <LoadingSkeleton label="Cargando despacho…" rows={2} /> : null}
      {dispatch.error ? <Alert>{dispatch.error.message}</Alert> : null}
      {dispatch.data ? (
        <>
          <PageHeader
            titleId="despacho-titulo"
            title={`Despacho ${dispatch.data.number}`}
            description={`${dispatch.data.driverName} · ${dispatch.data.siteName}`}
            meta={
              <>
                <Badge tone={tones[dispatch.data.status]}>
                  {DISPATCH_STATUS_LABELS[dispatch.data.status]}
                </Badge>
                <span className="text-caption text-ink-2">{formatDate(dispatch.data.dispatchDate)}</span>
                {dispatch.data.routeLocationName ? (
                  <span className="text-caption text-ink-2">En ruta: {dispatch.data.routeLocationName}</span>
                ) : null}
              </>
            }
          />
          {notice ? (
            <Alert tone={notice.tone === 'error' ? 'error' : notice.tone}>{notice.text}</Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardLabel>Pedidos</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{dispatch.data.orderCount}</p>
            </Card>
            <Card>
              <CardLabel>Cargado</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">
                {formatQuantity(dispatch.data.loadedTotal)}
              </p>
            </Card>
            <Card>
              <CardLabel>Entregado</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">
                {formatQuantity(dispatch.data.deliveredTotal)}
              </p>
            </Card>
          </div>

          {dispatch.data.status === 'prepared' && canLoad ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-4">
              <p className="text-body text-ink-2">
                Confirma la carga para mover los lotes reservados a "En ruta".
              </p>
              <Button
                onClick={() => {
                  setNotice(null);
                  load.mutate(dispatch.data.id, {
                    onSuccess: () => {
                      setNotice({ tone: 'success', text: 'Despacho cargado y en ruta.' });
                    },
                    onError: (error) => {
                      setNotice({ tone: 'error', text: error.message });
                    },
                  });
                }}
                disabled={load.isPending}
              >
                <Truck aria-hidden className="size-4" />{' '}
                {load.isPending ? 'Cargando…' : 'Confirmar carga y salir'}
              </Button>
            </div>
          ) : null}
          {dispatch.data.status === 'to_settle' ? (
            <Alert tone="info">
              Toda la mercancía cargada fue entregada. La liquidación del distribuidor sigue pendiente de
              P-08.
            </Alert>
          ) : null}

          <section aria-labelledby="despacho-pedidos" className="space-y-4">
            <h2 id="despacho-pedidos" className="font-display text-title font-bold text-ink">
              Pedidos
            </h2>
            {dispatch.data.orders.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="size-5" />}
                title="Sin pedidos"
                description="El despacho no tiene líneas cargadas."
              />
            ) : null}
            {dispatch.data.orders.map((order) => (
              <Card key={order.orderId}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-body font-semibold text-brand-ink">{order.orderNumber}</p>
                    <p className="text-body font-semibold text-ink">{order.customerName}</p>
                    <p className="text-caption text-ink-2">
                      {order.deliveryAddress ?? 'Sin dirección'} · {order.phone ?? 'Sin teléfono'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-caption text-ink-2">{PAYMENT_MODE_LABELS[order.paymentMode]}</p>
                    <p className="font-mono text-body font-semibold text-ink">{formatMoney(order.total)}</p>
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-line">
                  {order.lines.map((line) => (
                    <li key={line.dispatchLineId} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        <span className="block text-body text-ink">{line.itemName}</span>
                        <span className="text-caption text-ink-2">
                          {line.presentationName} · lote {line.lotCode}
                        </span>
                      </span>
                      <span className="text-right text-caption text-ink-2">
                        Cargado {formatQuantity(line.loadedQty)} · entregado{' '}
                        {formatQuantity(line.deliveredQty)} · devuelto {formatQuantity(line.returnedQty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </section>

          <section aria-labelledby="despacho-devoluciones" className="space-y-3">
            <h2 id="despacho-devoluciones" className="font-display text-title font-bold text-ink">
              Devoluciones
            </h2>
            {dispatch.data.returns.length === 0 ? (
              <p className="text-body text-ink-2">Sin devoluciones registradas.</p>
            ) : (
              <div className="space-y-3">
                {dispatch.data.returns.map((item) => (
                  <Card key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-body font-semibold text-brand-ink">{item.number}</p>
                        <p className="text-caption text-ink-2">
                          Lote {item.lotCode} · {formatQuantity(item.quantity)} · {item.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={item.status === 'reinstated' ? 'success' : 'warning'}>
                          {item.status === 'reinstated' ? 'Reincorporada' : 'En inspección'}
                        </Badge>
                        {item.status === 'in_inspection' && canInspect ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              inspect.mutate(
                                { returnId: item.id, input: { decision: 'reinstate' } },
                                {
                                  onSuccess: () => {
                                    setNotice({
                                      tone: 'success',
                                      text: `Devolución ${item.number} reincorporada a la bodega.`,
                                    });
                                  },
                                  onError: (error) => {
                                    setNotice({ tone: 'error', text: error.message });
                                  },
                                },
                              );
                            }}
                            disabled={inspect.isPending}
                          >
                            <CheckCircle2 aria-hidden className="size-4" /> Reincorporar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <p className="text-caption text-ink-2">
              El descarte de una devolución requiere aprobación AP-08 y no está disponible.
            </p>
          </section>
        </>
      ) : null}
    </section>
  );
}
