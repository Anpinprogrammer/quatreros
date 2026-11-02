import { PURCHASE_STATUS_LABELS, type MeResponse, type PurchaseStatus } from '@quatreros/contracts';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { Link, useParams } from 'react-router';
import { newIdempotencyKey } from '../../services/client';
import { hasPermission } from '../../hooks/session';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Card, CardLabel } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button, SelectField, TextField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { usePurchase, useReceivePurchase } from '../../services/compras';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatUnitCost,
} from '../../lib/format/compras';

const statusTones: Record<PurchaseStatus, BadgeTone> = {
  pending_receipt: 'warning',
  partially_received: 'info',
  received: 'success',
};

/** Detalle y recepción de una compra (RF-051, RF-052). */
export function PurchasePage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const purchase = usePurchase(id);
  const canReceive = hasPermission(me, 'comp.receipt.create');
  const receive = useReceivePurchase();
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [locationId, setLocationId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);
  useDocumentTitle(purchase.data ? `Compra ${purchase.data.number}` : 'Compra');

  const receivedTotal = (purchase.data?.lines ?? []).reduce(
    (sum, line) => sum + Number(line.receivedQuantity),
    0,
  );
  const pendingTotal = (purchase.data?.lines ?? []).reduce(
    (sum, line) => sum + Number(line.pendingQuantity),
    0,
  );

  return (
    <section aria-labelledby="compra-titulo" className="space-y-8">
      <Link
        to="/erp/compras"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Compras
      </Link>

      {purchase.isPending ? <LoadingSkeleton label="Cargando compra…" rows={2} /> : null}
      {purchase.error ? <Alert>{purchase.error.message}</Alert> : null}

      {purchase.data ? (
        <>
          <PageHeader
            titleId="compra-titulo"
            title={`Compra ${purchase.data.number}`}
            description={`${purchase.data.supplierName} · ${purchase.data.siteName}`}
            meta={
              <>
                <Badge tone={statusTones[purchase.data.status]}>
                  {PURCHASE_STATUS_LABELS[purchase.data.status]}
                </Badge>
                <span className="text-caption text-ink-2">
                  Registrada el {formatDate(purchase.data.purchasedOn)}
                </span>
              </>
            }
          />

          {notice ? (
            <Alert tone={notice.tone === 'error' ? 'error' : notice.tone}>{notice.text}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardLabel>Total</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{formatMoney(purchase.data.total)}</p>
              <p className="text-caption text-ink-2">Sin impuestos (P-02)</p>
            </Card>
            <Card>
              <CardLabel>Recibido</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{formatQuantity(String(receivedTotal))}</p>
              <p className="text-caption text-ink-2">Unidades base</p>
            </Card>
            <Card>
              <CardLabel>Pendiente</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{formatQuantity(String(pendingTotal))}</p>
              <p className="text-caption text-ink-2">Unidades base</p>
            </Card>
            <Card>
              <CardLabel>Recepciones</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{purchase.data.receipts.length}</p>
              <p className="text-caption text-ink-2">Cada una crea sus lotes</p>
            </Card>
          </div>

          <section aria-labelledby="compra-lineas" className="space-y-3">
            <h2 id="compra-lineas" className="font-display text-title font-bold text-ink">
              Líneas
            </h2>
            <DataTable minWidth="56rem" label="Líneas de la compra">
              <caption className="sr-only">Materia prima, cantidad, costo y saldo pendiente</caption>
              <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Materia prima
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Cantidad
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Costo unitario
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Recibido
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Pendiente
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchase.data.lines.map((line) => (
                  <tr key={line.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3">
                      <span className="block font-semibold text-ink">{line.rawMaterialName}</span>
                      <span className="text-caption text-ink-2">Unidad: {line.unit}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.quantity)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatUnitCost(line.unitCost)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.receivedQuantity)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.pendingQuantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>

          <section aria-labelledby="compra-recepciones" className="space-y-3">
            <h2 id="compra-recepciones" className="font-display text-title font-bold text-ink">
              Recepciones
            </h2>
            {purchase.data.receipts.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="size-5" />}
                title="Sin recepciones"
                description="La mercancía todavía no ha entrado al inventario."
              />
            ) : (
              <div className="space-y-4">
                {purchase.data.receipts.map((receipt) => (
                  <Card key={receipt.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-body font-semibold text-brand-ink">{receipt.number}</p>
                        <p className="text-caption text-ink-2">
                          {formatDateTime(receipt.receivedAt)} · {receipt.locationName} ·{' '}
                          {receipt.receivedByName ?? 'Sistema'}
                        </p>
                      </div>
                      <Badge tone="success">Publicada</Badge>
                    </div>
                    <ul className="mt-3 divide-y divide-line">
                      {receipt.lines.map((line) => (
                        <li key={line.id} className="flex flex-wrap justify-between gap-2 py-2">
                          <span className="font-mono text-body text-ink">{line.lotCode}</span>
                          <span className="text-caption text-ink-2">
                            {formatQuantity(line.quantity)} · vence {formatDate(line.expiresOn)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {purchase.data.status === 'received' ? (
            <Alert tone="success">Compra recibida completa. Sus lotes ya están en existencias.</Alert>
          ) : canReceive ? (
            <section aria-labelledby="compra-recibir" className="space-y-3">
              <h2 id="compra-recibir" className="font-display text-title font-bold text-ink">
                Recibir materia prima
              </h2>
              <form
                className="flex max-w-4xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
                aria-label={`Recibir compra ${purchase.data.number}`}
                onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  setNotice(null);
                  const lines = purchase.data.lines
                    .map((line) => {
                      const raw = quantities[line.id];
                      const quantity = raw === undefined ? line.pendingQuantity : raw.trim();
                      return { line, quantity };
                    })
                    .filter(({ quantity }) => quantity !== '' && quantity !== '0' && Number(quantity) > 0)
                    .map(({ line, quantity }) => ({
                      purchaseLineId: line.id,
                      quantity,
                      ...(line.tracksExpiry && expiries[line.id] ? { expiresOn: expiries[line.id] } : {}),
                    }));
                  if (!locationId) {
                    setNotice({ tone: 'error', text: 'Selecciona la ubicación de recepción.' });
                    return;
                  }
                  if (lines.length === 0) {
                    setNotice({ tone: 'error', text: 'Indica al menos una cantidad por recibir.' });
                    return;
                  }
                  const missingExpiry = purchase.data.lines.find(
                    (line) =>
                      line.tracksExpiry &&
                      lines.some((item) => item.purchaseLineId === line.id && !item.expiresOn),
                  );
                  if (missingExpiry) {
                    setNotice({
                      tone: 'error',
                      text: `Indica el vencimiento de ${missingExpiry.rawMaterialName}.`,
                    });
                    return;
                  }
                  receive.mutate(
                    {
                      purchaseId: purchase.data.id,
                      input: { locationId, lines },
                      idempotencyKey,
                    },
                    {
                      onSuccess: (response) => {
                        setQuantities({});
                        setExpiries({});
                        setIdempotencyKey(newIdempotencyKey());
                        setNotice({
                          tone: response.data.status === 'received' ? 'success' : 'info',
                          text:
                            response.data.status === 'received'
                              ? 'Recepción registrada. La compra quedó completa.'
                              : 'Recepción registrada. La compra sigue abierta por el saldo pendiente.',
                        });
                      },
                      onError: (error) => {
                        setNotice({ tone: 'error', text: error.message });
                      },
                    },
                  );
                }}
              >
                <p className="text-body text-ink-2">
                  Confirma lo que llegó. Se crea un lote por materia prima recibida y la entrada al
                  inventario. Si recibes menos, la compra queda abierta por el saldo.
                </p>
                <SelectField
                  label="Ubicación de recepción"
                  options={[
                    { value: '', label: 'Selecciona la ubicación' },
                    ...purchase.data.receptionLocations.map((location) => ({
                      value: location.id,
                      label: location.name,
                    })),
                  ]}
                  value={locationId}
                  hint={`Solo ubicaciones de ${purchase.data.siteName}.`}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                  }}
                />
                <div className="space-y-3">
                  {purchase.data.lines.map((line) => (
                    <div
                      key={line.id}
                      className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <div className="flex flex-col justify-center">
                        <p className="font-semibold text-ink">{line.rawMaterialName}</p>
                        <p className="text-caption text-ink-2">
                          Pendiente: {formatQuantity(line.pendingQuantity)} {line.unit}
                        </p>
                      </div>
                      <TextField
                        label={`Recibido · ${line.rawMaterialName}`}
                        type="number"
                        min={0}
                        step={0.001}
                        inputMode="decimal"
                        value={quantities[line.id] ?? line.pendingQuantity}
                        hint={`Máximo ${formatQuantity(line.pendingQuantity)}`}
                        onChange={(e) => {
                          setQuantities((current) => ({ ...current, [line.id]: e.target.value }));
                        }}
                      />
                      {line.tracksExpiry ? (
                        <TextField
                          label={`Vence · ${line.rawMaterialName}`}
                          type="date"
                          value={expiries[line.id] ?? ''}
                          hint="Obligatorio para esta materia prima"
                          onChange={(e) => {
                            setExpiries((current) => ({ ...current, [line.id]: e.target.value }));
                          }}
                        />
                      ) : (
                        <div className="hidden md:block" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={receive.isPending || pendingTotal === 0}>
                    {receive.isPending ? 'Recibiendo…' : 'Confirmar recepción'}
                  </Button>
                </div>
              </form>
            </section>
          ) : (
            <Alert tone="info">
              Tu rol no registra recepciones. Un comprador, manager o administrador debe confirmar la llegada.
            </Alert>
          )}
        </>
      ) : null}
    </section>
  );
}
