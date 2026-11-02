import {
  PRODUCTION_ORDER_STATUS_LABELS,
  type MeResponse,
  type ProductionOrderStatus,
} from '@quatreros/contracts';
import { ArrowLeft, CheckCircle2, Factory } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { Link, useParams } from 'react-router';
import { newIdempotencyKey } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Card, CardLabel } from '../../shared/ui/Card';
import { DataTable } from '../../shared/ui/DataTable';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Alert, Button, SelectField, TextField } from '../../shared/ui/form';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useProduct } from '../catalogo/api';
import { useCloseOrder, useConsumeOrder, useOrder } from './api';
import { formatDate, formatDateTime, formatPercent, formatQuantity } from './format';

const statusTones: Record<ProductionOrderStatus, BadgeTone> = {
  planned: 'warning',
  in_progress: 'info',
  closed: 'success',
};

/** Detalle de una orden: consumo por lote y cierre con lote PT (RF-082, RF-083). */
export function OrderPage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const order = useOrder(id);
  const product = useProduct(order.data?.productId ?? '');
  const canExecute = hasPermission(me, 'prod.order.execute');
  const consume = useConsumeOrder();
  const close = useCloseOrder();
  const [consumeKey, setConsumeKey] = useState(newIdempotencyKey);
  const [closeKey, setCloseKey] = useState(newIdempotencyKey);
  const [lots, setLots] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [yieldNote, setYieldNote] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);
  useDocumentTitle(order.data ? `Orden ${order.data.number}` : 'Orden de producción');

  const outputBase = (product.data?.presentations ?? []).reduce((sum, presentation) => {
    const quantity = Number(outputs[presentation.id] ?? 0);
    return sum + quantity * Number(presentation.unitsPer);
  }, 0);
  const actual = order.data ? Number(order.data.actualQty ?? '0') : 0;
  const yieldPreview =
    order.data && Number(order.data.plannedQty) > 0
      ? ((order.data.status === 'closed' ? actual : outputBase) / Number(order.data.plannedQty)) * 100
      : 0;
  const expected = order.data ? Number(order.data.expectedYieldPct) : 0;
  const tolerance = order.data ? Number(order.data.tolerancePct) : 0;
  const outOfTolerance = Math.abs(yieldPreview - expected) > tolerance;

  return (
    <section aria-labelledby="orden-titulo" className="space-y-8">
      <Link
        to="/erp/produccion"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Producción
      </Link>

      {order.isPending ? <LoadingSkeleton label="Cargando orden…" rows={2} /> : null}
      {order.error ? <Alert>{order.error.message}</Alert> : null}

      {order.data ? (
        <>
          <PageHeader
            titleId="orden-titulo"
            title={`Orden ${order.data.number}`}
            description={`${order.data.productName} · ${order.data.siteName}`}
            meta={
              <>
                <Badge tone={statusTones[order.data.status]}>
                  {PRODUCTION_ORDER_STATUS_LABELS[order.data.status]}
                </Badge>
                <span className="text-caption text-ink-2">
                  Receta v{order.data.recipeVersion} · creada {formatDateTime(order.data.createdAt)}
                </span>
              </>
            }
          />

          {notice ? (
            <Alert tone={notice.tone === 'error' ? 'error' : notice.tone}>{notice.text}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardLabel>Planificado</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{formatQuantity(order.data.plannedQty)}</p>
              <p className="text-caption text-ink-2">Unidad base</p>
            </Card>
            <Card>
              <CardLabel>Producido</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">
                {order.data.actualQty ? formatQuantity(order.data.actualQty) : '—'}
              </p>
              <p className="text-caption text-ink-2">Unidad base</p>
            </Card>
            <Card>
              <CardLabel>Rendimiento</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">
                {order.data.yieldPct ? formatPercent(order.data.yieldPct) : '—'}
              </p>
              <p className="text-caption text-ink-2">
                Esperado {formatPercent(order.data.expectedYieldPct)} ±{' '}
                {formatPercent(order.data.tolerancePct)}
              </p>
            </Card>
            <Card>
              <CardLabel>Lote PT</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">{order.data.outputLotCode ?? '—'}</p>
              <p className="text-caption text-ink-2">
                {order.data.outputLotId ? 'Producto terminado en existencia' : 'Se crea al cerrar'}
              </p>
            </Card>
          </div>

          <section aria-labelledby="consumo-teorico" className="space-y-3">
            <h2 id="consumo-teorico" className="font-display text-title font-bold text-ink">
              Consumo teórico
            </h2>
            <DataTable minWidth="48rem" label="Consumo teórico y disponibilidad">
              <caption className="sr-only">Consumo teórico por materia prima y disponibilidad</caption>
              <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Materia prima
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Teórico
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Disponible
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Alcanza
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.data.theoreticalConsumption.map((line) => (
                  <tr key={line.rawMaterialId} className="border-b border-line last:border-0">
                    <td className="px-3 py-3">
                      {line.rawMaterialName} <span className="text-caption text-ink-2">({line.unit})</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.theoreticalQuantity)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQuantity(line.availableQuantity)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={line.sufficient ? 'success' : 'warning'}>
                        {line.sufficient ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>

          <section aria-labelledby="consumo-real" className="space-y-3">
            <h2 id="consumo-real" className="font-display text-title font-bold text-ink">
              Consumo real
            </h2>
            {order.data.consumptions.length === 0 ? (
              <EmptyState
                icon={<Factory className="size-5" />}
                title="Sin consumo registrado"
                description="Registra los lotes de materia prima usados para iniciar la orden."
              />
            ) : (
              <DataTable minWidth="56rem" label="Consumo real por lote">
                <caption className="sr-only">Lotes consumidos, teórico y real</caption>
                <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Materia prima
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Lote
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Ubicación
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">
                      Teórico
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">
                      Real
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.data.consumptions.map((line) => (
                    <tr key={line.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-3">{line.rawMaterialName}</td>
                      <td className="px-3 py-3 font-mono">{line.lotCode}</td>
                      <td className="px-3 py-3 text-ink-2">{line.locationName}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {formatQuantity(line.theoreticalQuantity)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {formatQuantity(line.actualQuantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}

            {order.data.status === 'planned' ? (
              canExecute ? (
                <form
                  className="flex max-w-4xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
                  aria-label={`Registrar consumo de ${order.data.number}`}
                  onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    setNotice(null);
                    const lines = order.data.theoreticalConsumption
                      .map((line) => {
                        const lotId =
                          lots[line.rawMaterialId] ??
                          order.data.availableLots.find((item) => item.rawMaterialId === line.rawMaterialId)
                            ?.lotId;
                        const lot = order.data.availableLots.find((item) => item.lotId === lotId);
                        const quantity = quantities[line.rawMaterialId] ?? line.theoreticalQuantity;
                        return { line, lot, quantity };
                      })
                      .filter(({ lot, quantity }) => lot && quantity !== '' && Number(quantity) > 0)
                      .map(({ line, lot, quantity }) => ({
                        rawMaterialId: line.rawMaterialId,
                        lotId: lot?.lotId ?? '',
                        locationId: lot?.locationId ?? '',
                        quantity,
                      }));
                    if (lines.length === 0) {
                      setNotice({ tone: 'error', text: 'Selecciona al menos un lote y cantidad.' });
                      return;
                    }
                    consume.mutate(
                      { orderId: order.data.id, input: { lines }, idempotencyKey: consumeKey },
                      {
                        onSuccess: () => {
                          setConsumeKey(newIdempotencyKey());
                          setLots({});
                          setQuantities({});
                          setNotice({
                            tone: 'success',
                            text: 'Consumo registrado. La orden está en proceso.',
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
                    Elige el lote de cada materia prima. La sugerencia está ordenada por vencimiento (FEFO);
                    puedes ajustar la cantidad real.
                  </p>
                  <div className="space-y-3">
                    {order.data.theoreticalConsumption.map((line) => {
                      const materialLots = order.data.availableLots.filter(
                        (lot) => lot.rawMaterialId === line.rawMaterialId,
                      );
                      return (
                        <div
                          key={line.rawMaterialId}
                          className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)]"
                        >
                          <div className="flex flex-col justify-center">
                            <p className="font-semibold text-ink">{line.rawMaterialName}</p>
                            <p className="text-caption text-ink-2">
                              Teórico {formatQuantity(line.theoreticalQuantity)} {line.unit}
                            </p>
                          </div>
                          <SelectField
                            label={`Lote · ${line.rawMaterialName}`}
                            options={[
                              { value: '', label: 'Selecciona el lote' },
                              ...materialLots.map((lot) => ({
                                value: lot.lotId,
                                label: `${lot.code} · ${lot.locationName} · ${formatQuantity(lot.available)} (vence ${formatDate(lot.expiresOn)})`,
                              })),
                            ]}
                            value={lots[line.rawMaterialId] ?? materialLots[0]?.lotId ?? ''}
                            onChange={(e) => {
                              setLots((current) => ({ ...current, [line.rawMaterialId]: e.target.value }));
                            }}
                          />
                          <TextField
                            label={`Cantidad · ${line.rawMaterialName}`}
                            type="number"
                            min={0.001}
                            step={0.001}
                            inputMode="decimal"
                            value={quantities[line.rawMaterialId] ?? line.theoreticalQuantity}
                            onChange={(e) => {
                              setQuantities((current) => ({
                                ...current,
                                [line.rawMaterialId]: e.target.value,
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <Button type="submit" disabled={consume.isPending}>
                      {consume.isPending ? 'Registrando…' : 'Registrar consumo'}
                    </Button>
                  </div>
                </form>
              ) : (
                <Alert tone="info">
                  Tu rol no registra consumo. Un productor o manager debe ejecutar la orden.
                </Alert>
              )
            ) : null}
          </section>

          {order.data.status === 'in_progress' ? (
            <section aria-labelledby="cierre-orden" className="space-y-3">
              <h2 id="cierre-orden" className="font-display text-title font-bold text-ink">
                Cerrar orden
              </h2>
              {canExecute ? (
                <form
                  className="flex max-w-4xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
                  aria-label={`Cerrar orden ${order.data.number}`}
                  onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    setNotice(null);
                    const selected = (product.data?.presentations ?? [])
                      .map((presentation) => ({
                        presentationId: presentation.id,
                        quantity: outputs[presentation.id]?.trim() ?? '',
                      }))
                      .filter((output) => output.quantity !== '' && Number(output.quantity) > 0);
                    if (selected.length === 0) {
                      setNotice({ tone: 'error', text: 'Registra al menos una presentación producida.' });
                      return;
                    }
                    close.mutate(
                      {
                        orderId: order.data.id,
                        input: { outputs: selected, ...(yieldNote.trim() ? { yieldNote } : {}) },
                        idempotencyKey: closeKey,
                      },
                      {
                        onSuccess: (response) => {
                          setCloseKey(newIdempotencyKey());
                          setOutputs({});
                          setNotice({
                            tone: 'success',
                            text: `Orden cerrada. Lote ${response.data.outputLotCode ?? ''} creado.`,
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
                    Registra cuánto se produjo por presentación. Se crea el lote PT con fabricación y
                    vencimiento, y la entrada a la ubicación de producción.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(product.data?.presentations ?? [])
                      .filter((presentation) => presentation.isActive)
                      .map((presentation) => (
                        <TextField
                          key={presentation.id}
                          label={`Producido · ${presentation.name}`}
                          type="number"
                          min={0}
                          step={0.001}
                          inputMode="decimal"
                          value={outputs[presentation.id] ?? ''}
                          hint={`1 unidad = ${presentation.unitsPer} unidad base`}
                          onChange={(e) => {
                            setOutputs((current) => ({
                              ...current,
                              [presentation.id]: e.target.value,
                            }));
                          }}
                        />
                      ))}
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2/40 p-3 text-body">
                    <p>
                      Total en unidad base:{' '}
                      <span className="font-mono font-semibold text-ink">
                        {formatQuantity(outputBase.toFixed(3))}
                      </span>
                    </p>
                    <p className={outOfTolerance ? 'text-warning' : 'text-ink-2'}>
                      Rendimiento estimado:{' '}
                      <span className="font-mono">{formatPercent(yieldPreview.toFixed(2))}</span> · esperado{' '}
                      {formatPercent(order.data.expectedYieldPct)} ± {formatPercent(order.data.tolerancePct)}
                    </p>
                  </div>
                  {outOfTolerance ? (
                    <TextField
                      label="Motivo del rendimiento"
                      value={yieldNote}
                      required
                      hint="Obligatorio porque el rendimiento está fuera de la tolerancia."
                      onChange={(e) => {
                        setYieldNote(e.target.value);
                      }}
                    />
                  ) : null}
                  <div>
                    <Button type="submit" disabled={close.isPending}>
                      {close.isPending ? 'Cerrando…' : 'Cerrar orden y crear lote PT'}
                    </Button>
                  </div>
                  <p className="text-caption text-ink-2">
                    El costo oficial del lote queda pendiente de decisión (P-03). Se registran las cantidades
                    y los lotes de materia prima.
                  </p>
                </form>
              ) : (
                <Alert tone="info">
                  Tu rol no cierra órdenes. Un productor o manager debe registrar la producción real.
                </Alert>
              )}
            </section>
          ) : null}

          {order.data.status === 'closed' ? (
            <Alert tone="success">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 aria-hidden className="size-4" /> Orden cerrada. Lote{' '}
                {order.data.outputLotCode ?? '—'} en existencia.
              </span>
              {order.data.yieldNote ? (
                <span className="mt-1 block text-body">Motivo: {order.data.yieldNote}</span>
              ) : null}
            </Alert>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
