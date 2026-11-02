import { TRANSFER_STATUS_LABELS, type MeResponse, type TransferStatus } from '@quatreros/contracts';
import { Truck } from 'lucide-react';
import { useMemo, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { hasPermission } from '../../hooks/session';
import { Badge, type BadgeTone } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { Alert, Button, SelectField, TextField } from '../ui/form';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { formatDateTime } from '../../lib/format/existencias';
import { useAvailability } from '../../services/existencias';
import { useCreateTransfer, useTransfers } from '../../services/traslados';
import { useProducts } from '../../services/catalogo';

const statusTones: Record<TransferStatus, BadgeTone> = {
  in_transit: 'warning',
  received: 'success',
  received_with_variance: 'danger',
};

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...(['in_transit', 'received', 'received_with_variance'] as const).map((value) => ({
    value,
    label: TRANSFER_STATUS_LABELS[value],
  })),
];

/** Traslados entre ubicaciones (RF-114), dentro de Existencias. */
export function TransfersPanel({ me }: { me: MeResponse }) {
  const [status, setStatus] = useState<'' | TransferStatus>('');
  const [creating, setCreating] = useState(false);
  const transfers = useTransfers({ status: status || undefined, limit: 100 });
  const canCreate = hasPermission(me, 'inv.transfer.create');
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-title font-bold text-ink">Traslados</h2>
          <p className="mt-1 text-body text-ink-2">
            La mercancía sale de origen, queda en tránsito y entra al destino cuando se recibe.
          </p>
        </div>
        {canCreate && !creating ? (
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            Nuevo traslado
          </Button>
        ) : null}
      </div>

      {creating ? (
        <TransferForm
          onDone={(id) => {
            setCreating(false);
            void navigate(`/erp/existencias/traslados/${id}`);
          }}
          onCancel={() => {
            setCreating(false);
          }}
        />
      ) : null}

      <div className="max-w-xs">
        <SelectField
          label="Estado del traslado"
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | TransferStatus);
          }}
        />
      </div>

      {transfers.isPending ? <LoadingSkeleton label="Cargando traslados…" rows={2} /> : null}
      {transfers.error ? <Alert>{transfers.error.message}</Alert> : null}
      {transfers.data && transfers.data.data.length === 0 ? (
        <EmptyState
          title="Sin traslados"
          description={
            canCreate
              ? 'Crea un traslado para mover producto de bodega al punto de venta.'
              : 'Todavía no hay traslados registrados.'
          }
          action={
            canCreate ? (
              <Button
                onClick={() => {
                  setCreating(true);
                }}
              >
                Crear el primero
              </Button>
            ) : null
          }
        />
      ) : null}
      {transfers.data && transfers.data.data.length > 0 ? (
        <DataTable minWidth="62rem" label="Traslados entre ubicaciones">
          <caption className="sr-only">Traslados entre ubicaciones</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Traslado
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Ruta
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Estado
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Enviado
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Líneas
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Receptor
              </th>
            </tr>
          </thead>
          <tbody>
            {transfers.data.data.map((transfer) => (
              <tr key={transfer.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link
                    to={`/erp/existencias/traslados/${transfer.id}`}
                    className="font-mono text-brand-ink hover:text-ink"
                  >
                    {transfer.number}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <span className="block">
                    {transfer.fromLocationName} → {transfer.toLocationName}
                  </span>
                  <span className="text-caption text-ink-2">
                    {transfer.fromSiteName} → {transfer.toSiteName}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[transfer.status]}>{TRANSFER_STATUS_LABELS[transfer.status]}</Badge>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-2">
                  {formatDateTime(transfer.sentAt)}
                  <span className="block text-caption">{transfer.sentByName ?? 'Sistema'}</span>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{transfer.lineCount}</td>
                <td className="px-3 py-3 text-ink-2">
                  {transfer.receivedByName ?? '—'}
                  {transfer.receivedAt ? (
                    <span className="block text-caption">{formatDateTime(transfer.receivedAt)}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </div>
  );
}

function TransferForm({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const availability = useAvailability({ limit: 200 });
  const products = useProducts({ status: 'active' });
  const create = useCreateTransfer();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [presentationId, setPresentationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const error = create.error as ApiError | null;

  const locations = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of availability.data?.data ?? []) {
      map.set(row.locationId, `${row.locationName} · ${row.siteName}`);
    }
    return [...map].map(([value, label]) => ({ value, label }));
  }, [availability.data]);

  const presentations = useMemo(
    () =>
      (products.data?.data ?? []).flatMap((product) =>
        product.presentations
          .filter((presentation) => presentation.isActive)
          .map((presentation) => ({
            value: presentation.id,
            label: `${product.name} · ${presentation.name}`,
          })),
      ),
    [products.data],
  );

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (!fromLocationId || !toLocationId) {
      setLocalError('Selecciona la ubicación de origen y la de destino.');
      return;
    }
    if (fromLocationId === toLocationId) {
      setLocalError('El origen y el destino deben ser distintos.');
      return;
    }
    if (!presentationId || !/^\d{1,11}(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
      setLocalError('Selecciona una presentación y escribe una cantidad mayor que 0.');
      return;
    }
    create.mutate(
      {
        input: { fromLocationId, toLocationId, lines: [{ presentationId, quantity }] },
        idempotencyKey,
      },
      {
        onSuccess: (res) => {
          onDone(res.data.id);
        },
      },
    );
  };

  return (
    <form
      className="flex max-w-3xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label="Nuevo traslado"
    >
      <h3 className="flex items-center gap-2 font-display text-title font-bold text-ink">
        <Truck aria-hidden className="size-5 text-brand" />
        Nuevo traslado
      </h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      {availability.isPending || products.isPending ? (
        <p className="text-body text-ink-2">Cargando ubicaciones y productos…</p>
      ) : null}
      {locations.length < 2 ? (
        <Alert tone="info">Necesitas al menos dos ubicaciones con existencias para crear un traslado.</Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Origen"
          options={[{ value: '', label: 'Selecciona el origen' }, ...locations]}
          value={fromLocationId}
          onChange={(e) => {
            setFromLocationId(e.target.value);
          }}
        />
        <SelectField
          label="Destino"
          options={[{ value: '', label: 'Selecciona el destino' }, ...locations]}
          value={toLocationId}
          onChange={(e) => {
            setToLocationId(e.target.value);
          }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SelectField
          label="Producto y presentación"
          options={[{ value: '', label: 'Selecciona una presentación' }, ...presentations]}
          value={presentationId}
          onChange={(e) => {
            setPresentationId(e.target.value);
          }}
        />
        <TextField
          label="Cantidad"
          type="number"
          min={0.001}
          step={0.001}
          inputMode="decimal"
          value={quantity}
          hint="En unidades de la presentación."
          onChange={(e) => {
            setQuantity(e.target.value);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={create.isPending || locations.length < 2}>
          {create.isPending ? 'Enviando…' : 'Enviar traslado'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
