import type { ShiftDetail } from '@quatreros/contracts';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardLabel } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button, TextField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMoney } from '../../lib/format/pos';
import { newIdempotencyKey } from '../../services/client';
import { useReviewShift, useShift, useShifts } from '../../services/pos';

/** Bandeja de cierres con diferencia para ADM/MGR (RF-224, BR-145). */
export function CashReviewPage() {
  useDocumentTitle('Diferencias de caja');
  const shifts = useShifts({ status: 'closed_with_variance', limit: 50 });
  const [selectedId, setSelectedId] = useState('');
  const shift = useShift(selectedId);
  const review = useReviewShift();
  const [conclusion, setConclusion] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    review.mutate(
      { id: selectedId, input: { conclusion }, idempotencyKey },
      {
        onSuccess: () => {
          setSelectedId('');
          setConclusion('');
          setIdempotencyKey(newIdempotencyKey());
        },
      },
    );
  };

  return (
    <section aria-labelledby="revision-titulo" className="space-y-6">
      <PageHeader
        titleId="revision-titulo"
        eyebrow="POS y cocina · Revisión"
        title="Diferencias de caja"
        description="Cierres con diferencia de efectivo que esperan la conclusión de un supervisor distinto del cajero."
        meta={<Badge tone="warning">{shifts.data?.data.length ?? 0} pendientes</Badge>}
      />

      {shifts.isPending ? <LoadingSkeleton label="Cargando cierres…" rows={2} /> : null}
      {shifts.error ? <Alert tone="error">{shifts.error.message}</Alert> : null}
      {shifts.data?.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-5" />}
          title="No hay cierres pendientes"
          description="Cuando un cajero cierre con diferencia, aparecerá aquí para revisión."
        />
      ) : null}

      {shifts.data && shifts.data.data.length > 0 ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shifts.data.data.map((item) => (
            <li key={item.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardLabel>{item.siteName}</CardLabel>
                    <h2 className="mt-1 font-display text-title font-bold text-ink">{item.cashierName}</h2>
                    <p className="text-caption text-ink-2">
                      Cerrado {formatDateTime(item.closedAt ?? item.openedAt)}
                    </p>
                  </div>
                  <Badge tone="warning">{item.saleCount} ventas</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-caption">
                  <div>
                    <dt className="text-ink-2">Esperado</dt>
                    <dd className="font-mono text-body text-ink">{formatMoney(item.cashExpected ?? '0')}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-2">Contado</dt>
                    <dd className="font-mono text-body text-ink">{formatMoney(item.cashCounted ?? '0')}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-2">Diferencia</dt>
                    <dd className="font-mono text-body font-semibold text-ink">
                      {formatMoney(item.cashDifference ?? '0')}
                    </dd>
                  </div>
                </dl>
                {item.closingNote ? <p className="mt-3 text-caption text-ink-2">{item.closingNote}</p> : null}
                <Button
                  className="mt-4 self-start"
                  variant="secondary"
                  onClick={() => {
                    setSelectedId(item.id);
                    setConclusion('');
                    setIdempotencyKey(newIdempotencyKey());
                  }}
                >
                  Revisar cierre
                  <ArrowRight aria-hidden className="size-4" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedId ? (
        <Card>
          {shift.isPending ? <LoadingSkeleton label="Cargando turno…" rows={2} /> : null}
          {shift.error ? <Alert tone="error">{shift.error.message}</Alert> : null}
          {shift.data ? (
            <ShiftReviewDetail
              shift={shift.data}
              conclusion={conclusion}
              onConclusion={setConclusion}
              busy={review.isPending}
              error={review.error?.message ?? null}
              onSubmit={submit}
              onCancel={() => {
                setSelectedId('');
              }}
            />
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}

function ShiftReviewDetail({
  shift,
  conclusion,
  onConclusion,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  shift: ShiftDetail;
  conclusion: string;
  onConclusion: (value: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardLabel>Turno de {shift.cashierName}</CardLabel>
          <p className="mt-1 font-display text-title font-bold text-ink">{shift.siteName}</p>
          <p className="text-caption text-ink-2">
            {formatDateTime(shift.openedAt)} → {shift.closedAt ? formatDateTime(shift.closedAt) : 'abierto'}
          </p>
        </div>
        <Badge tone="warning">{shift.status === 'closed_with_variance' ? 'Pendiente' : shift.status}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <CardLabel>Conteos</CardLabel>
          <DataTable minWidth="32rem" label="Conteos del turno">
            <caption className="sr-only">Esperado, contado y diferencia por medio de pago</caption>
            <thead className="border-b border-line text-caption text-ink-2 uppercase">
              <tr>
                <th scope="col" className="px-2 py-2 text-left">
                  Método
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Esperado
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Contado
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Diferencia
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shift.counts.map((count) => (
                <tr key={count.paymentMethodId}>
                  <th scope="row" className="px-2 py-2 text-left font-normal text-ink">
                    {count.paymentMethodName}
                  </th>
                  <td className="px-2 py-2 text-right font-mono">{formatMoney(count.expectedAmount)}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatMoney(count.countedAmount)}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatMoney(count.difference)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
        <Card className="p-4">
          <CardLabel>Ventas del turno</CardLabel>
          {shift.sales.length === 0 ? (
            <p className="mt-2 text-body text-ink-2">Sin ventas registradas.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {shift.sales.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="font-mono text-body text-ink">{sale.number}</span>
                  <span className="font-mono text-body text-ink">{formatMoney(sale.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        <TextField
          label="Conclusión del supervisor"
          value={conclusion}
          hint="Queda auditada junto con el turno."
          onChange={(event) => {
            onConclusion(event.target.value);
          }}
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || conclusion.trim().length < 3}>
            {busy ? 'Registrando…' : 'Registrar revisión'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
