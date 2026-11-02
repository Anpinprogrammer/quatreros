import {
  DISPATCH_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_MODE_LABELS,
  type MeResponse,
  type PaymentMethod,
} from '@quatreros/contracts';
import { ChevronLeft, Truck } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { newIdempotencyKey } from '../../services/client';
import { Badge } from '../../components/ui/Badge';
import { Card, CardLabel } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button, SelectField, TextField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { useDeliver, useDispatch, useDispatches, useRegisterReturn } from '../../services/ventas';
import { formatDate, formatMoney, formatQuantity } from '../../lib/format/ventas';

export function DriverDispatchPage({ me }: { me: MeResponse }) {
  const dispatches = useDispatches({ limit: 50 });
  const [selected, setSelected] = useState<string | null>(null);
  const dispatch = useDispatch(selected ?? '');
  const deliver = useDeliver();
  const registerReturn = useRegisterReturn();
  const [deliveryKeys, setDeliveryKeys] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, PaymentMethod>>({});
  const [collected, setCollected] = useState<Record<string, string>>({});
  const [returnLine, setReturnLine] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!selected) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-caption font-semibold tracking-[0.12em] text-ink-3 uppercase">Hoy</p>
          <h1 className="mt-1 font-display text-display font-bold text-ink">Rutas del día</h1>
          <p className="mt-1 text-body text-ink-2">
            Hola, {me.user.fullName}. Estos son tus despachos asignados.
          </p>
        </div>
        {dispatches.isPending ? <LoadingSkeleton label="Cargando despachos…" rows={2} /> : null}
        {dispatches.error ? <Alert>{dispatches.error.message}</Alert> : null}
        {dispatches.data?.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Truck className="size-5" />}
              title="Sin despachos asignados"
              description="Cuando te asignen una ruta aparecerá aquí."
            />
          </Card>
        ) : null}
        {dispatches.data?.data.map((item) => (
          <button
            key={item.id}
            type="button"
            className="w-full rounded-2xl border border-line bg-surface p-4 text-left shadow-card hover:border-brand/40"
            onClick={() => {
              setSelected(item.id);
              setNotice(null);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-body font-semibold text-brand-ink">{item.number}</span>
              <Badge
                tone={
                  item.status === 'in_route' ? 'warning' : item.status === 'to_settle' ? 'success' : 'info'
                }
              >
                {DISPATCH_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <p className="mt-1 text-caption text-ink-2">
              {formatDate(item.dispatchDate)} · {item.orderCount} pedido(s) ·{' '}
              {formatQuantity(item.loadedTotal)} cargado
            </p>
            <p className="mt-1 text-body font-semibold text-ink">
              Entregado {formatQuantity(item.deliveredTotal)}
            </p>
          </button>
        ))}
      </div>
    );
  }

  if (dispatch.isPending) return <LoadingSkeleton label="Cargando despacho…" rows={2} />;
  if (dispatch.error) return <Alert>{dispatch.error.message}</Alert>;
  return (
    <div className="space-y-4">
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-1 text-caption font-semibold uppercase text-ink-2"
        onClick={() => {
          setSelected(null);
          setNotice(null);
        }}
      >
        <ChevronLeft aria-hidden className="size-4" /> Volver a rutas
      </button>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-body font-semibold text-brand-ink">{dispatch.data.number}</p>
          <h1 className="font-display text-title font-bold text-ink">
            {DISPATCH_STATUS_LABELS[dispatch.data.status]}
          </h1>
        </div>
        <Badge tone={dispatch.data.status === 'in_route' ? 'warning' : 'success'}>
          {dispatch.data.routeLocationName ?? 'Sin ruta'}
        </Badge>
      </div>
      {notice ? <Alert tone={notice.tone === 'error' ? 'error' : notice.tone}>{notice.text}</Alert> : null}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardLabel>Cargado</CardLabel>
          <p className="mt-1 font-mono text-title text-ink">{formatQuantity(dispatch.data.loadedTotal)}</p>
        </Card>
        <Card>
          <CardLabel>Entregado</CardLabel>
          <p className="mt-1 font-mono text-title text-ink">{formatQuantity(dispatch.data.deliveredTotal)}</p>
        </Card>
      </div>

      {dispatch.data.status === 'prepared' ? (
        <Alert tone="info">El despacho aún no ha salido. El manager debe confirmar la carga.</Alert>
      ) : null}
      {dispatch.data.orders.map((order) => {
        const pendingLines = order.lines.filter((line) => Number(line.pendingQty) > 0);
        const deliveredValue = pendingLines.reduce(
          (sum, line) =>
            sum + Number(quantities[line.dispatchLineId] ?? line.pendingQty) * Number(line.unitPrice),
          0,
        );
        const isCash = order.paymentMode === 'cash_on_delivery';
        const key = deliveryKeys[order.orderId] ?? newIdempotencyKey();
        return (
          <Card key={order.orderId}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-caption text-brand-ink">{order.orderNumber}</p>
                <p className="text-body font-semibold text-ink">{order.customerName}</p>
                <p className="text-caption text-ink-2">
                  {order.deliveryAddress ?? 'Sin dirección'} · {order.phone ?? 'Sin teléfono'}
                </p>
              </div>
              <div className="text-right">
                <Badge tone={isCash ? 'info' : 'warning'}>{PAYMENT_MODE_LABELS[order.paymentMode]}</Badge>
                <p className="mt-1 font-mono text-body font-semibold text-ink">{formatMoney(order.total)}</p>
              </div>
            </div>
            {dispatch.data.status !== 'in_route' || pendingLines.length === 0 ? (
              <p className="mt-3 text-body text-ink-2">
                {pendingLines.length === 0
                  ? 'Pedido entregado.'
                  : 'Disponible cuando el despacho esté en ruta.'}
              </p>
            ) : (
              <form
                className="mt-3 space-y-3"
                aria-label={`Entregar ${order.orderNumber}`}
                onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  setNotice(null);
                  const lines = pendingLines
                    .map((line) => ({
                      dispatchLineId: line.dispatchLineId,
                      quantity: quantities[line.dispatchLineId] ?? line.pendingQty,
                    }))
                    .filter((line) => Number(line.quantity) > 0);
                  if (lines.length === 0) {
                    setNotice({ tone: 'error', text: 'Registra al menos una cantidad entregada.' });
                    return;
                  }
                  const partial = lines.some(
                    (line) =>
                      Number(line.quantity) <
                      Number(
                        pendingLines.find((item) => item.dispatchLineId === line.dispatchLineId)
                          ?.pendingQty ?? '0',
                      ),
                  );
                  if (partial && !(reasons[order.orderId] ?? '').trim()) {
                    setNotice({ tone: 'error', text: 'Escribe el motivo de la entrega parcial.' });
                    return;
                  }
                  const method = methods[order.orderId] ?? (isCash ? 'cash' : undefined);
                  const amount = collected[order.orderId] ?? (isCash ? deliveredValue.toFixed(2) : '');
                  deliver.mutate(
                    {
                      id: dispatch.data.id,
                      input: {
                        orderId: order.orderId,
                        lines,
                        ...(partial ? { partialReason: reasons[order.orderId] ?? '' } : {}),
                        ...(method ? { paymentMethod: method } : {}),
                        ...(amount ? { collectedAmount: amount } : {}),
                      },
                      idempotencyKey: key,
                    },
                    {
                      onSuccess: () => {
                        setDeliveryKeys((current) => ({ ...current, [order.orderId]: newIdempotencyKey() }));
                        setQuantities({});
                        setReasons({});
                        setCollected({});
                        setNotice({ tone: 'success', text: `Entrega de ${order.orderNumber} registrada.` });
                      },
                      onError: (error) => {
                        setNotice({ tone: 'error', text: error.message });
                      },
                    },
                  );
                }}
              >
                {pendingLines.map((line) => (
                  <div
                    key={line.dispatchLineId}
                    className="rounded-xl border border-line bg-surface-2/40 p-3"
                  >
                    <p className="text-body font-semibold text-ink">
                      {line.itemName} · {line.presentationName}
                    </p>
                    <p className="text-caption text-ink-2">
                      Lote {line.lotCode} · pendiente {formatQuantity(line.pendingQty)}
                    </p>
                    <TextField
                      label={`Entregado · ${line.lotCode}`}
                      type="number"
                      min={0}
                      step={0.001}
                      value={quantities[line.dispatchLineId] ?? line.pendingQty}
                      onChange={(e) => {
                        setQuantities((current) => ({ ...current, [line.dispatchLineId]: e.target.value }));
                      }}
                    />
                  </div>
                ))}
                <TextField
                  label="Motivo si es parcial"
                  value={reasons[order.orderId] ?? ''}
                  onChange={(e) => {
                    setReasons((current) => ({ ...current, [order.orderId]: e.target.value }));
                  }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Método de recaudo"
                    options={[
                      { value: '', label: 'Sin recaudo' },
                      ...Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label })),
                    ]}
                    value={methods[order.orderId] ?? ''}
                    onChange={(e) => {
                      setMethods((current) => ({
                        ...current,
                        [order.orderId]: e.target.value as PaymentMethod,
                      }));
                    }}
                  />
                  <TextField
                    label={isCash ? 'Recaudo (obligatorio)' : 'Abono (opcional)'}
                    type="number"
                    min={0}
                    step={0.01}
                    value={collected[order.orderId] ?? (isCash ? deliveredValue.toFixed(2) : '')}
                    onChange={(e) => {
                      setCollected((current) => ({ ...current, [order.orderId]: e.target.value }));
                    }}
                  />
                </div>
                <Button type="submit" disabled={deliver.isPending}>
                  {deliver.isPending ? 'Registrando…' : 'Registrar entrega'}
                </Button>
              </form>
            )}
          </Card>
        );
      })}

      {dispatch.data.status !== 'prepared' &&
      dispatch.data.orders.some((order) =>
        order.lines.some((line) => Number(line.deliveredQty) > Number(line.returnedQty)),
      ) ? (
        <Card>
          <h2 className="font-display text-card font-semibold text-ink">Registrar devolución</h2>
          <form
            className="mt-3 space-y-3"
            aria-label="Registrar devolución"
            onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
              event.preventDefault();
              setNotice(null);
              if (!returnLine || !returnQty || !returnReason.trim()) {
                setNotice({ tone: 'error', text: 'Selecciona el lote, la cantidad y el motivo.' });
                return;
              }
              registerReturn.mutate(
                {
                  id: dispatch.data.id,
                  input: { dispatchLineId: returnLine, quantity: returnQty, reason: returnReason },
                  idempotencyKey: newIdempotencyKey(),
                },
                {
                  onSuccess: () => {
                    setReturnLine('');
                    setReturnQty('');
                    setReturnReason('');
                    setNotice({ tone: 'success', text: 'Devolución registrada en inspección.' });
                  },
                  onError: (error) => {
                    setNotice({ tone: 'error', text: error.message });
                  },
                },
              );
            }}
          >
            <SelectField
              label="Línea entregada"
              options={[
                { value: '', label: 'Selecciona' },
                ...dispatch.data.orders.flatMap((order) =>
                  order.lines
                    .filter((line) => Number(line.deliveredQty) > Number(line.returnedQty))
                    .map((line) => ({
                      value: line.dispatchLineId,
                      label: `${order.orderNumber} · ${line.itemName} · lote ${line.lotCode}`,
                    })),
                ),
              ]}
              value={returnLine}
              onChange={(e) => {
                setReturnLine(e.target.value);
              }}
            />
            <TextField
              label="Cantidad devuelta"
              type="number"
              min={0.001}
              step={0.001}
              value={returnQty}
              onChange={(e) => {
                setReturnQty(e.target.value);
              }}
            />
            <TextField
              label="Motivo"
              value={returnReason}
              onChange={(e) => {
                setReturnReason(e.target.value);
              }}
            />
            <Button type="submit" variant="secondary" disabled={registerReturn.isPending}>
              {registerReturn.isPending ? 'Registrando…' : 'Registrar devolución'}
            </Button>
          </form>
        </Card>
      ) : null}
      <p className="text-caption text-ink-2">
        La liquidación de mercancía y dinero depende de P-08 y no está disponible.
      </p>
    </div>
  );
}
