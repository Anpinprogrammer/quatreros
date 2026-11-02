import { PAYMENT_MODE_LABELS, SALES_ORDER_STATUS_LABELS, type SalesOrderStatus } from '@quatreros/contracts';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Alert } from '../../shared/ui/form';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Card, CardLabel } from '../../shared/ui/Card';
import { DataTable } from '../../shared/ui/DataTable';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useOrder } from './api';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from './format';

const tones: Record<SalesOrderStatus, BadgeTone> = {
  confirmed: 'info',
  in_dispatch: 'warning',
  partially_delivered: 'warning',
  delivered: 'success',
};

export function SalesOrderPage() {
  const { id = '' } = useParams();
  const order = useOrder(id);
  useDocumentTitle(order.data ? `Pedido ${order.data.number}` : 'Pedido');

  return (
    <section aria-labelledby="pedido-titulo" className="space-y-8">
      <Link
        to="/erp/ventas"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Ventas
      </Link>
      {order.isPending ? <LoadingSkeleton label="Cargando pedido…" rows={2} /> : null}
      {order.error ? <Alert>{order.error.message}</Alert> : null}
      {order.data ? (
        <>
          <PageHeader
            titleId="pedido-titulo"
            title={`Pedido ${order.data.number}`}
            description={`${order.data.customerName} · ${order.data.siteName}`}
            meta={
              <>
                <Badge tone={tones[order.data.status]}>{SALES_ORDER_STATUS_LABELS[order.data.status]}</Badge>
                <span className="text-caption text-ink-2">{PAYMENT_MODE_LABELS[order.data.paymentMode]}</span>
                <span className="text-caption text-ink-2">
                  Confirmado {formatDateTime(order.data.confirmedAt)}
                </span>
              </>
            }
          />
          {order.data.creditWarning ? <Alert tone="info">{order.data.creditWarning}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardLabel>Total</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{formatMoney(order.data.total)}</p>
            </Card>
            <Card>
              <CardLabel>Líneas</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{order.data.lineCount}</p>
            </Card>
            <Card>
              <CardLabel>Entrega deseada</CardLabel>
              <p className="mt-2 text-body font-semibold text-ink">{formatDate(order.data.requestedDate)}</p>
            </Card>
            <Card>
              <CardLabel>Canal</CardLabel>
              <p className="mt-2 text-body font-semibold text-ink">{order.data.channel}</p>
            </Card>
          </div>
          <section aria-labelledby="pedido-lineas" className="space-y-3">
            <h2 id="pedido-lineas" className="font-display text-title font-bold text-ink">
              Líneas
            </h2>
            <DataTable minWidth="60rem" label="Líneas del pedido">
              <caption className="sr-only">Líneas, precio, reserva y pendientes</caption>
              <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Producto
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Pedido
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Reservado
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Entregado
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Pendiente
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Precio
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.data.lines.map((line) => (
                  <tr key={line.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3">
                      <span className="block font-semibold text-ink">{line.itemName}</span>
                      <span className="text-caption text-ink-2">{line.presentationName}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.orderedQty)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.reservedQty)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.deliveredQty)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.pendingQty)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatMoney(line.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatMoney(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>
        </>
      ) : null}
    </section>
  );
}
