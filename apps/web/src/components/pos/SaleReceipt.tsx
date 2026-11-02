import type { SaleDetail } from '@quatreros/contracts';
import { formatDateTime, formatMoney, formatQuantity } from '../../lib/format/pos';
import { Badge } from '../ui/Badge';
import { Card, CardLabel } from '../ui/Card';

/** Comprobante interno: no es factura y no se presenta como documento fiscal (BR-150). */
export function SaleReceipt({ sale }: { sale: SaleDetail }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardLabel>Comprobante interno</CardLabel>
          <p className="font-mono text-title font-bold text-ink">{sale.number}</p>
        </div>
        <Badge tone="info">{formatDateTime(sale.soldAt)}</Badge>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {sale.lines.map((line) => (
          <li key={line.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-ink">
                  {line.productName} · {line.presentationName}
                </p>
                <p className="text-caption text-ink-2">
                  {formatQuantity(line.quantity)} × {formatMoney(line.unitPrice)}
                  {line.recipeVersion ? ` · receta v${String(line.recipeVersion)}` : ''}
                </p>
              </div>
              <p className="shrink-0 font-mono text-body text-ink">{formatMoney(line.lineTotal)}</p>
            </div>
            {line.lots.length > 0 ? (
              <p className="mt-1 text-caption text-ink-3">
                Lotes: {line.lots.map((lot) => `${lot.lotCode} (${formatQuantity(lot.quantity)})`).join(', ')}
              </p>
            ) : null}
            {line.consumption.length > 0 ? (
              <p className="mt-1 text-caption text-ink-3">
                Consumo teórico:{' '}
                {line.consumption
                  .map((item) => `${formatQuantity(item.quantity)} ${item.unit} de ${item.name}`)
                  .join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <CardLabel>Pagos</CardLabel>
          <ul className="mt-2 space-y-1">
            {sale.payments.map((payment) => (
              <li key={payment.paymentMethodId} className="flex justify-between gap-2 text-body">
                <span className="text-ink-2">{payment.paymentMethodName}</span>
                <span className="font-mono text-ink">{formatMoney(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-body text-ink-2">Total</span>
            <span className="font-mono text-title font-bold text-ink">{formatMoney(sale.total)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-body text-ink-2">Cambio</span>
            <span className="font-mono text-body text-ink">{formatMoney(sale.changeAmount)}</span>
          </div>
        </Card>
      </div>

      <p className="rounded-xl border border-dashed border-line-strong bg-surface-2/60 px-4 py-3 text-caption text-ink-2">
        Comprobante interno — no es factura. La facturación fiscal está pendiente de decisión (P-02).
      </p>
    </div>
  );
}
