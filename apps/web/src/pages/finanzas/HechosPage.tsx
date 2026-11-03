import type { EconomicEventType } from '@quatreros/contracts';
import { ECONOMIC_EVENT_STATUS_LABELS } from '@quatreros/contracts';
import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, SelectField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMoney } from '../../lib/format/pos';
import { useEconomicEvents } from '../../services/accounting';

const TYPE_LABELS: Record<EconomicEventType, string> = {
  PurchaseReceived: 'Compra recibida',
  ProductionCompleted: 'Producción cerrada',
  SaleCompleted: 'Venta POS',
  ShiftClosed: 'Cierre de turno',
  ReceivableCreated: 'Obligación creada',
  PaymentReceived: 'Recaudo/abono',
  CollectionReconciled: 'Conciliación',
};

/** Bandeja de hechos económicos, solo lectura (RF-303). */
export function HechosPage() {
  useDocumentTitle('Hechos económicos');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const events = useEconomicEvents({
    ...(type ? { type: type as EconomicEventType } : {}),
    ...(status ? { status: status as 'pending' | 'posted' | 'void' } : {}),
    limit: 100,
  });

  return (
    <section aria-labelledby="hechos-titulo" className="space-y-6">
      <PageHeader
        titleId="hechos-titulo"
        eyebrow="Sistema · Contabilidad"
        title="Hechos económicos"
        description="Registro inmutable de las operaciones con efecto económico. Pendiente de contabilizar; la contabilidad formal sigue bloqueada (P-01..P-04)."
        meta={<Badge tone="warning">{events.data?.data.length ?? 0} visibles</Badge>}
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Tipo"
            options={[
              { value: '', label: 'Todos' },
              ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
            value={type}
            onChange={(event) => {
              setType(event.target.value);
            }}
          />
          <SelectField
            label="Estado"
            options={[
              { value: '', label: 'Todos' },
              ...Object.entries(ECONOMIC_EVENT_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
            }}
          />
        </div>
      </Card>

      {events.isPending ? <LoadingSkeleton label="Cargando hechos…" rows={3} /> : null}
      {events.error ? <Alert tone="error">{events.error.message}</Alert> : null}
      {events.data?.data.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="No hay hechos registrados"
          description="Las operaciones de compras, producción, POS y cartera aparecerán aquí."
        />
      ) : null}

      {events.data && events.data.data.length > 0 ? (
        <DataTable minWidth="60rem" label="Hechos económicos">
          <caption className="sr-only">Hechos económicos con tipo, origen, fecha, monto y estado</caption>
          <thead className="border-b border-line bg-surface-2/60 text-caption text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 text-left">
                Fecha
              </th>
              <th scope="col" className="px-3 py-3 text-left">
                Tipo
              </th>
              <th scope="col" className="px-3 py-3 text-left">
                Origen
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Monto
              </th>
              <th scope="col" className="px-3 py-3 text-left">
                Estado
              </th>
              <th scope="col" className="px-3 py-3 text-left">
                Detalle
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.data.data.map((event) => (
              <tr key={event.id}>
                <td className="px-3 py-3 font-mono text-caption text-ink-2">
                  {formatDateTime(event.occurredAt)}
                </td>
                <th scope="row" className="px-3 py-3 text-left text-body font-semibold text-ink">
                  {TYPE_LABELS[event.type]}
                </th>
                <td className="px-3 py-3 text-caption text-ink-2">
                  {event.sourceType}
                  <span className="block font-mono">{event.sourceId.slice(0, 8)}…</span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-body text-ink">
                  {event.amount ? formatMoney(event.amount) : '—'}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={event.status === 'pending' ? 'warning' : 'neutral'}>
                    {ECONOMIC_EVENT_STATUS_LABELS[event.status]}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <details>
                    <summary className="cursor-pointer text-caption font-semibold text-brand-ink">
                      Ver
                    </summary>
                    <pre className="mt-2 max-w-md overflow-auto rounded-lg bg-surface-2 p-2 text-[11px] text-ink-2">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}
