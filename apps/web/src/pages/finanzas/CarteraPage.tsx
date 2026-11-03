import type { CollectionView, MeResponse } from '@quatreros/contracts';
import {
  AGING_BUCKET_LABELS,
  COLLECTION_STATUS_LABELS,
  COLLECTOR_TYPE_LABELS,
  RECEIVABLE_STATUS_LABELS,
} from '@quatreros/contracts';
import { Download, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Card, CardLabel } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { PaymentForm } from '../../components/finanzas/PaymentForm';
import { ReconciliationForm } from '../../components/finanzas/ReconciliationForm';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { hasPermission } from '../../lib/session';
import { formatDateTime, formatMoney } from '../../lib/format/pos';
import {
  downloadReport,
  useAging,
  useCollections,
  useReconciliations,
  useReceivables,
} from '../../services/finance';

type Tab = 'cartera' | 'recaudos' | 'conciliacion';

const statusTones: Record<string, BadgeTone> = {
  open: 'info',
  partially_paid: 'warning',
  paid: 'success',
  registered: 'warning',
  reconciled: 'success',
  reconciled_with_variance: 'danger',
};

/** Cartera, abonos, recaudos y conciliación (entrega 7). */
export function CarteraPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Cartera y recaudos');
  const [tab, setTab] = useState<Tab>('cartera');
  const [customerId, setCustomerId] = useState('');
  const aging = useAging();
  const receivables = useReceivables({ customerId, limit: 100 });
  const pending = useCollections({ status: 'registered', limit: 100 });
  const reconciliations = useReconciliations({ limit: 50 });
  const [exportError, setExportError] = useState<string | null>(null);
  const canPay = hasPermission(me, 'fin.receivable_payment.create');

  const customer = aging.data?.customers.find((item) => item.customerId === customerId);
  const pendingGroups = new Map<string, CollectionView[]>();
  for (const collection of pending.data?.data ?? []) {
    const key = `${collection.siteId}:${collection.collectorType}:${collection.collectorUserId ?? ''}`;
    const group = pendingGroups.get(key) ?? [];
    group.push(collection);
    pendingGroups.set(key, group);
  }

  const exportCartera = () => {
    setExportError(null);
    void downloadReport('/reports/cartera/export', 'cartera.csv').catch((error: unknown) => {
      setExportError(error instanceof Error ? error.message : 'No fue posible exportar.');
    });
  };

  return (
    <section aria-labelledby="cartera-titulo" className="space-y-6">
      <PageHeader
        titleId="cartera-titulo"
        eyebrow="Gestión · Cartera y contabilidad"
        title="Cartera y recaudos"
        description="Obligaciones por antigüedad, abonos aplicados, recaudos por responsable y conciliación."
        actions={
          <Button variant="secondary" onClick={exportCartera}>
            <Download aria-hidden className="size-4" />
            Exportar cartera
          </Button>
        }
        meta={
          aging.data ? <Badge tone="warning">{formatMoney(aging.data.totals.overdue)} vencido</Badge> : null
        }
      />

      {exportError ? <Alert tone="error">{exportError}</Alert> : null}

      <div
        className="flex gap-1 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label="Vistas de cartera"
      >
        {(
          [
            ['cartera', 'Cartera'],
            ['recaudos', 'Recaudos'],
            ['conciliacion', 'Conciliación'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            id={`cartera-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`cartera-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => {
              setTab(value);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              const values = ['cartera', 'recaudos', 'conciliacion'] as const;
              const index = values.indexOf(tab);
              const next =
                values[(index + (event.key === 'ArrowRight' ? 1 : values.length - 1)) % values.length];
              if (!next) return;
              setTab(next);
              document.getElementById(`cartera-tab-${next}`)?.focus();
            }}
            className={`-mb-px min-h-12 shrink-0 rounded-t-lg border-b-2 px-4 text-body font-semibold transition-colors duration-200 ${
              tab === value ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="cartera-panel-cartera"
        aria-labelledby="cartera-tab-cartera"
        hidden={tab !== 'cartera'}
      >
        {tab === 'cartera' ? (
          <>
            {aging.isPending ? <LoadingSkeleton label="Cargando cartera…" rows={3} /> : null}
            {aging.error ? <Alert tone="error">{aging.error.message}</Alert> : null}
            {aging.data ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardLabel>Total abierto</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-ink">
                    {formatMoney(aging.data.totals.open)}
                  </p>
                </Card>
                <Card>
                  <CardLabel>Vencido</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-danger">
                    {formatMoney(aging.data.totals.overdue)}
                  </p>
                </Card>
                <Card>
                  <CardLabel>Por vencer</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-ink">
                    {formatMoney(aging.data.totals.dueSoon)}
                  </p>
                </Card>
                <Card>
                  <CardLabel>Recaudos pendientes</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-ink">
                    {pending.data?.data.length ?? 0}
                  </p>
                </Card>
              </div>
            ) : null}

            {aging.data && aging.data.customers.length > 0 ? (
              <DataTable minWidth="60rem" label="Cartera por cliente">
                <caption className="sr-only">Clientes con saldo, antigüedad y acción de abono</caption>
                <thead className="border-b border-line bg-surface-2/60 text-caption text-ink-2 uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left">
                      Cliente
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Total
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Vencido
                    </th>
                    {Object.values(AGING_BUCKET_LABELS).map((label) => (
                      <th key={label} scope="col" className="px-3 py-3 text-right">
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-right">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {aging.data.customers.map((row) => (
                    <tr key={row.customerId} className="hover:bg-surface-2/50">
                      <th scope="row" className="px-3 py-3 text-left font-semibold text-ink">
                        {row.customerName}
                      </th>
                      <td className="px-3 py-3 text-right font-mono text-ink">{formatMoney(row.total)}</td>
                      <td className="px-3 py-3 text-right font-mono text-danger">
                        {formatMoney(row.overdue)}
                      </td>
                      {Object.keys(AGING_BUCKET_LABELS).map((key) => (
                        <td key={key} className="px-3 py-3 text-right font-mono text-ink-2">
                          {formatMoney(row.buckets[key as keyof typeof row.buckets])}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setCustomerId(row.customerId);
                          }}
                        >
                          {canPay ? 'Ver / abonar' : 'Ver obligaciones'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : null}

            {customerId ? (
              <div
                className={
                  canPay ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]' : 'grid gap-4'
                }
              >
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardLabel>Obligaciones</CardLabel>
                      <p className="mt-1 font-display text-title font-bold text-ink">
                        {customer?.customerName ?? 'Cliente'}
                      </p>
                    </div>
                    <Badge tone="neutral">{receivables.data?.data.length ?? 0}</Badge>
                  </div>
                  {receivables.isPending ? <LoadingSkeleton label="Cargando obligaciones…" rows={2} /> : null}
                  {receivables.data?.data.length === 0 ? (
                    <p className="mt-3 text-body text-ink-2">Sin obligaciones abiertas.</p>
                  ) : null}
                  {receivables.data && receivables.data.data.length > 0 ? (
                    <ul className="mt-3 divide-y divide-line">
                      {receivables.data.data.map((obligation) => (
                        <li
                          key={obligation.id}
                          className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                        >
                          <div>
                            <p className="text-body font-semibold text-ink">
                              {obligation.sourceType} · vence {obligation.dueOn}
                            </p>
                            <p className="text-caption text-ink-2">
                              {obligation.daysOverdue > 0
                                ? `${String(obligation.daysOverdue)} días vencida`
                                : 'Por vencer'}{' '}
                              · {obligation.siteName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-body text-ink">{formatMoney(obligation.balance)}</p>
                            <Badge tone={statusTones[obligation.status] ?? 'neutral'}>
                              {RECEIVABLE_STATUS_LABELS[obligation.status]}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
                {canPay ? (
                  <Card>
                    <CardLabel>Registrar abono</CardLabel>
                    <div className="mt-3">
                      <PaymentForm me={me} initialCustomerId={customerId} />
                    </div>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="cartera-panel-recaudos"
        aria-labelledby="cartera-tab-recaudos"
        hidden={tab !== 'recaudos'}
      >
        {tab === 'recaudos' ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardLabel>Recaudos registrados</CardLabel>
                <p className="mt-1 font-display text-title font-bold text-ink">Por responsable y sede</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  void downloadReport('/reports/recaudos/export', 'recaudos.csv');
                }}
              >
                <Download aria-hidden className="size-4" />
                Exportar
              </Button>
            </div>
            {pending.isPending ? <LoadingSkeleton label="Cargando recaudos…" rows={3} /> : null}
            {pending.data && pending.data.data.length > 0 ? (
              <DataTable minWidth="55rem" label="Recaudos">
                <caption className="sr-only">
                  Recaudos por número, responsable, cliente, método y estado
                </caption>
                <thead className="border-t border-line text-caption text-ink-2 uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left">
                      Número
                    </th>
                    <th scope="col" className="px-3 py-3 text-left">
                      Responsable
                    </th>
                    <th scope="col" className="px-3 py-3 text-left">
                      Cliente
                    </th>
                    <th scope="col" className="px-3 py-3 text-left">
                      Método
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Monto
                    </th>
                    <th scope="col" className="px-3 py-3 text-left">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pending.data.data.map((collection) => (
                    <tr key={collection.id}>
                      <th scope="row" className="px-3 py-3 text-left font-mono text-ink">
                        {collection.number}
                      </th>
                      <td className="px-3 py-3 text-ink-2">
                        {collection.collectorName ?? COLLECTOR_TYPE_LABELS[collection.collectorType]}
                        <span className="block text-caption">{collection.siteName}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{collection.customerName ?? '—'}</td>
                      <td className="px-3 py-3 text-ink-2">{collection.paymentMethodName}</td>
                      <td className="px-3 py-3 text-right font-mono text-ink">
                        {formatMoney(collection.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTones[collection.status] ?? 'neutral'}>
                          {COLLECTION_STATUS_LABELS[collection.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyState
                icon={<Wallet className="size-5" />}
                title="No hay recaudos pendientes"
                description="Los recaudos de distribuidor y oficina aparecerán aquí."
              />
            )}
          </Card>
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="cartera-panel-conciliacion"
        aria-labelledby="cartera-tab-conciliacion"
        hidden={tab !== 'conciliacion'}
      >
        {tab === 'conciliacion' ? (
          <div className="space-y-4">
            {pending.isPending ? <LoadingSkeleton label="Cargando pendientes…" rows={2} /> : null}
            {pendingGroups.size === 0 ? (
              <EmptyState
                icon={<Wallet className="size-5" />}
                title="No hay recaudos por conciliar"
                description="Cuando un distribuidor u oficina registre un recaudo, aparecerá aquí."
              />
            ) : null}
            {[...pendingGroups.values()].map((group) => (
              <ReconciliationForm key={group[0]?.id} collections={group} />
            ))}
            <Card>
              <CardLabel>Conciliaciones registradas</CardLabel>
              {reconciliations.data?.data.length === 0 ? (
                <p className="mt-2 text-body text-ink-2">Todavía no hay conciliaciones.</p>
              ) : null}
              <ul className="mt-3 divide-y divide-line">
                {reconciliations.data?.data.map((reconciliation) => (
                  <li
                    key={reconciliation.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-mono text-body font-semibold text-ink">{reconciliation.number}</p>
                      <p className="text-caption text-ink-2">
                        {reconciliation.collectorName ?? 'Sin responsable'} ·{' '}
                        {formatDateTime(reconciliation.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-body text-ink">
                        {formatMoney(reconciliation.receivedAmount)} recibido
                      </p>
                      <Badge tone={reconciliation.variance === '0.00' ? 'success' : 'danger'}>
                        Diferencia {formatMoney(reconciliation.variance)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : null}
      </div>
    </section>
  );
}
