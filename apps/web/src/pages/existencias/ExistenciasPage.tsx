import {
  ITEM_KIND_LABELS,
  LOT_STATUS_LABELS,
  LotStatus,
  MOVEMENT_TYPE_LABELS,
  MovementType,
  type LotStatus as LotStatusType,
  type MeResponse,
  type MovementType as MovementTypeType,
} from '@quatreros/contracts';
import { Boxes, CalendarClock, Package, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, SelectField, TextField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { ModuleIcon } from '../../components/ui/ModuleIcon';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { BalanceTable } from '../../components/existencias/BalanceTable';
import {
  useAvailability,
  useInventorySummary,
  useLots,
  useMovements,
  useStockBalances,
} from '../../services/existencias';
import { formatDate, formatQuantity } from '../../lib/format/existencias';
import { MovementTable } from '../../components/existencias/MovementTable';
import { TransfersPanel } from '../../components/existencias/TransfersPanel';
import { LotStatusBadge } from '../../components/existencias/StatusBadge';

type Tab = 'balances' | 'lots' | 'kardex' | 'transfers';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...LotStatus.options.map((value) => ({ value, label: LOT_STATUS_LABELS[value] })),
];

const movementOptions = [
  { value: '', label: 'Todos los tipos' },
  ...MovementType.options.map((value) => ({ value, label: MOVEMENT_TYPE_LABELS[value] })),
];

/** Existencias y kardex (RF-110, RF-111), dentro de 04. Producción. */
export function ExistenciasPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Existencias');
  const [tab, setTab] = useState<Tab>('balances');
  const summary = useInventorySummary();
  const locations = useAvailability({ limit: 200 });
  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of locations.data?.data ?? []) {
      map.set(row.locationId, `${row.locationName} · ${row.siteName}`);
    }
    return [
      { value: '', label: 'Todas las ubicaciones' },
      ...[...map].map(([value, label]) => ({ value, label })),
    ];
  }, [locations.data]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'balances', label: 'Existencias' },
    { id: 'lots', label: 'Lotes' },
    { id: 'kardex', label: 'Kardex' },
    { id: 'transfers', label: 'Traslados' },
  ];

  return (
    <section aria-labelledby="existencias-titulo" className="space-y-8">
      <PageHeader
        titleId="existencias-titulo"
        eyebrow={
          <>
            <ModuleIcon name="boxes" className="size-3.5" />
            <span>04 · Operaciones</span>
          </>
        }
        title="Existencias y traslados"
        description="Saldos reales por lote, presentación y ubicación, con vencimientos y kardex. Los traslados entre ubicaciones llegan en la entrega 2c."
        meta={
          <span className="text-caption text-ink-2">{me.sites.map((site) => site.name).join(' · ')}</span>
        }
      />

      <section aria-labelledby="resumen-existencias">
        <h2 id="resumen-existencias" className="sr-only">
          Resumen de existencias
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Productos con saldo"
            value={summary.data ? String(summary.data.productsWithStock) : '—'}
            hint="Productos terminados con al menos un lote"
            tone="brand"
            icon={<Package className="size-4" />}
          />
          <StatCard
            label="Materias primas con saldo"
            value={summary.data ? String(summary.data.rawMaterialsWithStock) : '—'}
            hint="Insumos disponibles para producción"
            icon={<Boxes className="size-4" />}
          />
          <StatCard
            label="Lotes por vencer"
            value={summary.data ? String(summary.data.lotsNearExpiry) : '—'}
            hint="Vencen en los próximos 7 días"
            tone={summary.data && summary.data.lotsNearExpiry > 0 ? 'warning' : 'neutral'}
            icon={<CalendarClock className="size-4" />}
          />
          <StatCard
            label="Lotes vencidos"
            value={summary.data ? String(summary.data.expiredLots) : '—'}
            hint="Excluidos de disponible; el retiro depende de P-05"
            tone={summary.data && summary.data.expiredLots > 0 ? 'warning' : 'neutral'}
            icon={<TriangleAlert className="size-4" />}
          />
        </div>
      </section>

      <div role="tablist" aria-label="Existencias" className="flex gap-1 border-b border-line">
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              id={`existencias-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`existencias-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={`min-h-12 border-b-2 px-4 text-body font-semibold transition-colors duration-200 ${selected ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
              onClick={() => {
                setTab(item.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                const index = tabs.findIndex((x) => x.id === tab);
                const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                if (!next) return;
                setTab(next.id);
                document.getElementById(`existencias-tab-${next.id}`)?.focus();
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id="existencias-panel-balances"
        role="tabpanel"
        aria-labelledby="existencias-tab-balances"
        hidden={tab !== 'balances'}
      >
        {tab === 'balances' ? <BalancesPanel locationOptions={locationOptions} /> : null}
      </div>
      <div
        id="existencias-panel-lots"
        role="tabpanel"
        aria-labelledby="existencias-tab-lots"
        hidden={tab !== 'lots'}
      >
        {tab === 'lots' ? <LotsPanel /> : null}
      </div>
      <div
        id="existencias-panel-kardex"
        role="tabpanel"
        aria-labelledby="existencias-tab-kardex"
        hidden={tab !== 'kardex'}
      >
        {tab === 'kardex' ? <KardexPanel /> : null}
      </div>
      <div
        id="existencias-panel-transfers"
        role="tabpanel"
        aria-labelledby="existencias-tab-transfers"
        hidden={tab !== 'transfers'}
      >
        {tab === 'transfers' ? <TransfersPanel me={me} /> : null}
      </div>
    </section>
  );
}

function BalancesPanel({ locationOptions }: { locationOptions: { value: string; label: string }[] }) {
  const [q, setQ] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState<'' | LotStatusType>('');
  const [expiresBefore, setExpiresBefore] = useState('');
  const balances = useStockBalances({
    q,
    locationId,
    status: status || undefined,
    expiresBefore: expiresBefore || undefined,
    limit: 100,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card md:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          label="Buscar por producto, materia prima o lote"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
        <SelectField
          label="Ubicación"
          options={locationOptions}
          value={locationId}
          onChange={(e) => {
            setLocationId(e.target.value);
          }}
        />
        <SelectField
          label="Estado del lote"
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | LotStatusType);
          }}
        />
        <TextField
          label="Vence antes de"
          type="date"
          value={expiresBefore}
          onChange={(e) => {
            setExpiresBefore(e.target.value);
          }}
        />
      </div>

      {balances.isPending ? <LoadingSkeleton label="Cargando existencias…" rows={2} /> : null}
      {balances.error ? <Alert>{balances.error.message}</Alert> : null}
      {balances.data && balances.data.data.length === 0 ? (
        <EmptyState
          title="Sin existencias con esos filtros"
          description="Prueba con otra ubicación, estado o fecha de vencimiento."
        />
      ) : null}
      {balances.data && balances.data.data.length > 0 ? <BalanceTable balances={balances.data.data} /> : null}
      {balances.data?.page.nextCursor ? (
        <p className="text-caption text-ink-2">Hay más saldos de los que caben en esta página.</p>
      ) : null}
    </div>
  );
}

function LotsPanel() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | LotStatusType>('');
  const [expiresBefore, setExpiresBefore] = useState('');
  const lots = useLots({
    q,
    status: status || undefined,
    expiresBefore: expiresBefore || undefined,
    limit: 100,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card md:grid-cols-3">
        <SearchInput
          label="Buscar por ítem o código de lote"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
        <SelectField
          label="Estado del lote"
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | LotStatusType);
          }}
        />
        <TextField
          label="Vence antes de"
          type="date"
          value={expiresBefore}
          onChange={(e) => {
            setExpiresBefore(e.target.value);
          }}
        />
      </div>

      {lots.isPending ? <LoadingSkeleton label="Cargando lotes…" rows={2} /> : null}
      {lots.error ? <Alert>{lots.error.message}</Alert> : null}
      {lots.data && lots.data.data.length === 0 ? (
        <EmptyState
          title="Sin lotes con esos filtros"
          description="La carga inicial y las compras crean los lotes; ajusta la búsqueda."
        />
      ) : null}
      {lots.data && lots.data.data.length > 0 ? (
        <DataTable minWidth="62rem">
          <caption className="sr-only">Lotes de inventario</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Lote
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Ítem
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Tipo
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Fabricado
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Vence
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Saldo total
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {lots.data.data.map((lot) => (
              <tr key={lot.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link
                    to={`/erp/existencias/lotes/${lot.id}`}
                    className="font-mono text-brand-ink hover:text-ink"
                  >
                    {lot.code}
                  </Link>
                </td>
                <th scope="row" className="px-3 py-3 font-normal">
                  <span className="block font-semibold text-ink">{lot.itemName}</span>
                  <span className="text-caption text-ink-2">{ITEM_KIND_LABELS[lot.itemKind]}</span>
                </th>
                <td className="px-3 py-3">{lot.lotType === 'finished_good' ? 'PT' : 'MP'}</td>
                <td className="px-3 py-3 text-ink-2">{formatDate(lot.manufacturedOn)}</td>
                <td
                  className={`px-3 py-3 whitespace-nowrap ${lot.isExpired ? 'font-semibold text-danger' : 'text-ink-2'}`}
                >
                  {formatDate(lot.expiresOn)}
                </td>
                <td className="px-3 py-3 text-right font-mono whitespace-nowrap tabular-nums">
                  {formatQuantity(lot.totalQuantity)}{' '}
                  <span className="text-caption text-ink-2">{lot.baseUnit}</span>
                </td>
                <td className="px-3 py-3">
                  <LotStatusBadge status={lot.status} isExpired={lot.isExpired} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
      {lots.data?.page.nextCursor ? (
        <p className="text-caption text-ink-2">Hay más lotes de los que caben en esta página.</p>
      ) : null}
    </div>
  );
}

function KardexPanel() {
  const [q, setQ] = useState('');
  const [movementType, setMovementType] = useState<'' | MovementTypeType>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const movements = useMovements({
    q,
    movementType: movementType || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: 100,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card md:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          label="Buscar por lote o ítem"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
        <SelectField
          label="Tipo de movimiento"
          options={movementOptions}
          value={movementType}
          onChange={(e) => {
            setMovementType(e.target.value as '' | MovementTypeType);
          }}
        />
        <TextField
          label="Desde"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
          }}
        />
        <TextField
          label="Hasta"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
          }}
        />
      </div>

      {movements.isPending ? <LoadingSkeleton label="Cargando kardex…" rows={2} /> : null}
      {movements.error ? <Alert>{movements.error.message}</Alert> : null}
      {movements.data && movements.data.data.length === 0 ? (
        <EmptyState
          title="Sin movimientos con esos filtros"
          description="El kardex registra entradas, salidas y la carga inicial; ajusta el rango de fechas."
        />
      ) : null}
      {movements.data && movements.data.data.length > 0 ? (
        <MovementTable movements={movements.data.data} />
      ) : null}
      {movements.data?.page.nextCursor ? (
        <p className="text-caption text-ink-2">Hay más movimientos de los que caben en esta página.</p>
      ) : null}
    </div>
  );
}
