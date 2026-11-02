import { TRANSFER_STATUS_LABELS, type MeResponse, type TransferStatus } from '@quatreros/contracts';
import { ArrowLeft } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { Link, useParams } from 'react-router';
import { newIdempotencyKey } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Card, CardLabel } from '../../shared/ui/Card';
import { DataTable } from '../../shared/ui/DataTable';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Alert, Button, TextField } from '../../shared/ui/form';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { formatDate, formatDateTime, formatQuantity } from './format';
import { useReceiveTransfer, useTransfer } from './transfers-api';

const statusTones: Record<TransferStatus, BadgeTone> = {
  in_transit: 'warning',
  received: 'success',
  received_with_variance: 'danger',
};

/** Detalle y recepción de un traslado (RF-114). */
export function TransferPage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const transfer = useTransfer(id);
  const canReceive = hasPermission(me, 'inv.transfer.receive');
  const receive = useReceiveTransfer();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  useDocumentTitle(transfer.data ? `Traslado ${transfer.data.number}` : 'Traslado');

  return (
    <section aria-labelledby="traslado-titulo" className="space-y-8">
      <Link
        to="/erp/existencias"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Existencias
      </Link>

      {transfer.isPending ? <LoadingSkeleton label="Cargando traslado…" rows={2} /> : null}
      {transfer.error ? <Alert>{transfer.error.message}</Alert> : null}

      {transfer.data ? (
        <>
          <PageHeader
            titleId="traslado-titulo"
            title={`Traslado ${transfer.data.number}`}
            description={`${transfer.data.fromLocationName} → ${transfer.data.toLocationName}`}
            meta={
              <>
                <Badge tone={statusTones[transfer.data.status]}>
                  {TRANSFER_STATUS_LABELS[transfer.data.status]}
                </Badge>
                <span className="text-caption text-ink-2">
                  {transfer.data.fromSiteName} → {transfer.data.toSiteName}
                </span>
              </>
            }
          />

          {notice ? (
            <Alert tone={notice.tone === 'error' ? 'error' : notice.tone}>{notice.text}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardLabel>Enviado</CardLabel>
              <p className="mt-2 font-semibold text-ink">{transfer.data.sentByName ?? 'Sistema'}</p>
              <p className="text-caption text-ink-2">{formatDateTime(transfer.data.sentAt)}</p>
            </Card>
            <Card>
              <CardLabel>Recibido</CardLabel>
              <p className="mt-2 font-semibold text-ink">{transfer.data.receivedByName ?? 'Pendiente'}</p>
              <p className="text-caption text-ink-2">
                {transfer.data.receivedAt ? formatDateTime(transfer.data.receivedAt) : 'Aún en tránsito'}
              </p>
            </Card>
            <Card>
              <CardLabel>Líneas</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{transfer.data.lineCount}</p>
              <p className="text-caption text-ink-2">Lotes asignados por FEFO</p>
            </Card>
            <Card>
              <CardLabel>Estado</CardLabel>
              <p className="mt-2 font-semibold text-ink">{TRANSFER_STATUS_LABELS[transfer.data.status]}</p>
              <p className="text-caption text-ink-2">
                {transfer.data.status === 'in_transit'
                  ? 'La mercancía está en la ubicación En tránsito.'
                  : 'La mercancía ya está en el destino.'}
              </p>
            </Card>
          </div>

          <section aria-labelledby="traslado-lineas" className="space-y-3">
            <h2 id="traslado-lineas" className="font-display text-title font-bold text-ink">
              Líneas y lotes
            </h2>
            {transfer.data.lines.length === 0 ? (
              <EmptyState title="Sin líneas" description="El traslado no tiene lotes asignados." />
            ) : (
              <DataTable minWidth="56rem" label="Líneas del traslado">
                <caption className="sr-only">Líneas del traslado con lote y cantidades</caption>
                <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Lote
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Ítem
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Vence
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">
                      Enviado
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">
                      Recibido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transfer.data.lines.map((line) => (
                    <tr key={line.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-3 font-mono">{line.lotCode}</td>
                      <td className="px-3 py-3">
                        <span className="block">{line.itemName}</span>
                        <span className="text-caption text-ink-2">{line.presentationName}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{formatDate(line.expiresOn)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {formatQuantity(line.sentQuantity)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {line.receivedQuantity === null ? '—' : formatQuantity(line.receivedQuantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </section>

          {transfer.data.status === 'in_transit' ? (
            <section aria-labelledby="traslado-recibir" className="space-y-3">
              <h2 id="traslado-recibir" className="font-display text-title font-bold text-ink">
                Recibir en destino
              </h2>
              {canReceive ? (
                <form
                  className="flex max-w-3xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
                  aria-label={`Recibir traslado ${transfer.data.number}`}
                  onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    setNotice(null);
                    const lines = transfer.data.lines.map((line) => {
                      const raw = received[line.id];
                      const value = raw === undefined ? line.sentQuantity : raw.trim();
                      return {
                        lineId: line.id,
                        receivedQuantity: value === '' ? '0' : value,
                      };
                    });
                    receive.mutate(
                      { transferId: transfer.data.id, input: { lines }, idempotencyKey },
                      {
                        onSuccess: (res) => {
                          setNotice({
                            tone: res.data.status === 'received_with_variance' ? 'info' : 'success',
                            text:
                              res.data.status === 'received_with_variance'
                                ? 'Traslado recibido con novedad. La diferencia queda en tránsito.'
                                : 'Traslado recibido completo.',
                          });
                        },
                        onError: (err) => {
                          setNotice({ tone: 'error', text: err.message });
                        },
                      },
                    );
                  }}
                >
                  <p className="text-body text-ink-2">
                    Confirma la cantidad que llegó. Si recibes menos, la diferencia queda en tránsito como
                    novedad.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {transfer.data.lines.map((line) => (
                      <TextField
                        key={line.id}
                        label={`Recibido · ${line.lotCode}`}
                        type="number"
                        min={0}
                        step={0.001}
                        inputMode="decimal"
                        value={received[line.id] ?? line.sentQuantity}
                        hint={`Enviado: ${formatQuantity(line.sentQuantity)}`}
                        onChange={(e) => {
                          setReceived((current) => ({ ...current, [line.id]: e.target.value }));
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={receive.isPending}>
                      {receive.isPending ? 'Confirmando…' : 'Confirmar recepción'}
                    </Button>
                  </div>
                </form>
              ) : (
                <Alert tone="info">
                  Tu rol no recibe traslados. Un manager o administrador debe confirmar la llegada.
                </Alert>
              )}
            </section>
          ) : (
            <Alert tone={transfer.data.status === 'received' ? 'success' : 'info'}>
              {transfer.data.status === 'received'
                ? 'Traslado recibido completo.'
                : 'Traslado recibido con novedad. La diferencia sigue en tránsito hasta que se resuelva.'}
            </Alert>
          )}
        </>
      ) : null}
    </section>
  );
}
