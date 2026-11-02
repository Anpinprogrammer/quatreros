import {
  PURCHASE_STATUS_LABELS,
  type MeResponse,
  type PurchaseStatus,
  type RawMaterialView,
} from '@quatreros/contracts';
import { PackageCheck, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { hasPermission } from '../../hooks/session';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterBar } from '../../components/ui/FilterBar';
import { Alert, Button, SelectField, TextField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useRawMaterials } from '../../services/catalogo';
import { useCreatePurchase, usePurchases, useSuppliers } from '../../services/compras';
import { formatDate, formatMoney } from '../../lib/format/compras';
import { SuppliersPanel } from '../../components/compras/SuppliersPanel';

type Tab = 'purchases' | 'suppliers';

const statusTones: Record<PurchaseStatus, BadgeTone> = {
  pending_receipt: 'warning',
  partially_received: 'info',
  received: 'success',
};

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...(['pending_receipt', 'partially_received', 'received'] as const).map((value) => ({
    value,
    label: PURCHASE_STATUS_LABELS[value],
  })),
];

/** Compras y recepción (RF-050..052), sección 06. */
export function PurchasesPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Compras y recepción');
  const [tab, setTab] = useState<Tab>('purchases');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'purchases', label: 'Compras' },
    { id: 'suppliers', label: 'Proveedores' },
  ];

  return (
    <section aria-labelledby="compras-titulo" className="space-y-7">
      <PageHeader
        titleId="compras-titulo"
        eyebrow={
          <Link to="/erp/seccion/compras" className="hover:text-ink">
            Compras
          </Link>
        }
        title="Compras y recepción"
        description="Registra la compra y recibe la materia prima. Solo la recepción crea el lote y mueve el inventario."
      />

      <div role="tablist" aria-label="Compras" className="flex gap-1 border-b border-line">
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              id={`compras-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`compras-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={`-mb-px min-h-12 rounded-t-lg border-b-2 px-4 text-body font-semibold transition-colors duration-200 ${selected ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
              onClick={() => {
                setTab(item.id);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const index = tabs.findIndex((x) => x.id === tab);
                const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                if (!next) return;
                setTab(next.id);
                document.getElementById(`compras-tab-${next.id}`)?.focus();
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id="compras-panel-purchases"
        role="tabpanel"
        aria-labelledby="compras-tab-purchases"
        hidden={tab !== 'purchases'}
      >
        {tab === 'purchases' ? <PurchasesPanel me={me} /> : null}
      </div>
      <div
        id="compras-panel-suppliers"
        role="tabpanel"
        aria-labelledby="compras-tab-suppliers"
        hidden={tab !== 'suppliers'}
      >
        {tab === 'suppliers' ? <SuppliersPanel me={me} /> : null}
      </div>
    </section>
  );
}

function PurchasesPanel({ me }: { me: MeResponse }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<'' | PurchaseStatus>('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const canCreate = hasPermission(me, 'comp.purchase.create');
  const purchases = usePurchases({ status: status || undefined, q, limit: 100 });
  const navigate = useNavigate();

  const closeForm = (message?: string, id?: string) => {
    setCreating(false);
    if (message) toast.show(message);
    if (id) void navigate(`/erp/compras/${id}`);
    else requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <section aria-labelledby="lista-compras-titulo" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="lista-compras-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-title font-bold text-ink outline-none"
          >
            Compras
          </h2>
          <p className="mt-1 text-body text-ink-2">
            La compra no mueve existencias: el lote nace cuando se recibe.
          </p>
        </div>
        {canCreate && !creating ? (
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden className="size-4" /> Nueva compra
          </Button>
        ) : null}
      </div>

      {creating ? (
        <PurchaseForm
          me={me}
          onDone={(message, id) => {
            closeForm(message, id);
          }}
          onCancel={() => {
            closeForm();
          }}
        />
      ) : null}

      <FilterBar>
        <div className="grid gap-3 sm:grid-cols-2">
          <SearchInput
            label="Buscar compra"
            placeholder="Número o proveedor"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
          />
          <SelectField
            label="Estado"
            options={statusOptions}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as '' | PurchaseStatus);
            }}
          />
        </div>
      </FilterBar>

      {purchases.isPending ? <LoadingSkeleton label="Cargando compras…" rows={2} /> : null}
      {purchases.error ? <Alert>{purchases.error.message}</Alert> : null}
      {purchases.data && purchases.data.data.length === 0 ? (
        <EmptyState
          icon={<PackageCheck className="size-5" />}
          title={q || status ? 'Ninguna compra coincide' : 'Sin compras'}
          description={
            q || status
              ? 'Prueba con otro número, proveedor o estado.'
              : 'Registra la primera compra para recibir materia prima.'
          }
          action={
            !q && !status && canCreate ? (
              <Button
                onClick={() => {
                  setCreating(true);
                }}
              >
                Registrar compra
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {purchases.data && purchases.data.data.length > 0 ? (
        <DataTable minWidth="64rem" label="Compras registradas">
          <caption className="sr-only">Compras registradas por número, proveedor, sede y estado</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Compra
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Proveedor
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Sede
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Fecha
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Total
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Estado
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Líneas
              </th>
            </tr>
          </thead>
          <tbody>
            {purchases.data.data.map((purchase) => (
              <tr key={purchase.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link
                    to={`/erp/compras/${purchase.id}`}
                    className="font-mono text-brand-ink hover:text-ink"
                  >
                    {purchase.number}
                  </Link>
                </td>
                <td className="px-3 py-3 text-ink">{purchase.supplierName}</td>
                <td className="px-3 py-3 text-ink-2">{purchase.siteName}</td>
                <td className="px-3 py-3 text-ink-2">{formatDate(purchase.purchasedOn)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">
                  {formatMoney(purchase.total)}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[purchase.status]}>{PURCHASE_STATUS_LABELS[purchase.status]}</Badge>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-2">
                  {purchase.lineCount}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}

interface DraftLine {
  rawMaterialId: string;
  quantity: string;
  unitCost: string;
}

const emptyLine: DraftLine = { rawMaterialId: '', quantity: '', unitCost: '' };

function PurchaseForm({
  me,
  onDone,
  onCancel,
}: {
  me: MeResponse;
  onDone: (message: string, id: string) => void;
  onCancel: () => void;
}) {
  const suppliers = useSuppliers({ status: 'active' });
  const materials = useRawMaterials({ status: 'active' });
  const create = useCreatePurchase();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [supplierId, setSupplierId] = useState('');
  const [siteId, setSiteId] = useState(me.sites[0]?.id ?? '');
  const [purchasedOn, setPurchasedOn] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [localError, setLocalError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const error = create.error as ApiError | null;

  const materialOptions = [
    { value: '', label: 'Selecciona una materia prima' },
    ...(materials.data?.data ?? []).map((material) => ({
      value: material.id,
      label: `${material.name} (${material.unit})`,
    })),
  ];
  const materialMap = new Map((materials.data?.data ?? []).map((material) => [material.id, material]));
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (!supplierId || !siteId) {
      setLocalError('Selecciona el proveedor y la sede.');
      return;
    }
    if (lines.length === 0) {
      setLocalError('Agrega al menos una línea.');
      return;
    }
    for (const line of lines) {
      if (!line.rawMaterialId) {
        setLocalError('Selecciona la materia prima de cada línea.');
        return;
      }
      if (!/^\d{1,11}(\.\d{1,3})?$/.test(line.quantity) || Number(line.quantity) <= 0) {
        setLocalError('Cada cantidad debe ser mayor que 0, con hasta 3 decimales.');
        return;
      }
      if (!/^\d{1,11}(\.\d{1,4})?$/.test(line.unitCost) || Number(line.unitCost) <= 0) {
        setLocalError('Cada costo unitario debe ser mayor que 0, con hasta 4 decimales.');
        return;
      }
    }
    create.mutate(
      {
        input: { supplierId, siteId, purchasedOn, lines },
        idempotencyKey,
      },
      {
        onSuccess: (response) => {
          onDone(`Compra ${response.data.number} registrada.`, response.data.id);
        },
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label="Nueva compra"
    >
      <h3 ref={titleRef} tabIndex={-1} className="font-display text-title font-bold text-ink outline-none">
        Nueva compra
      </h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <SelectField
          label="Proveedor"
          options={[
            { value: '', label: 'Selecciona el proveedor' },
            ...(suppliers.data?.data ?? []).map((supplier) => ({
              value: supplier.id,
              label: supplier.name,
            })),
          ]}
          value={supplierId}
          error={error?.fieldError('supplierId')}
          onChange={(e) => {
            setSupplierId(e.target.value);
          }}
        />
        <SelectField
          label="Sede"
          options={me.sites.map((site) => ({ value: site.id, label: site.name }))}
          value={siteId}
          error={error?.fieldError('siteId')}
          onChange={(e) => {
            setSiteId(e.target.value);
          }}
        />
        <TextField
          label="Fecha de compra"
          type="date"
          value={purchasedOn}
          onChange={(e) => {
            setPurchasedOn(e.target.value);
          }}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-body font-semibold text-ink">Líneas de materia prima</h4>
          <Button
            variant="secondary"
            onClick={() => {
              setLines((current) => [...current, { ...emptyLine }]);
            }}
          >
            <Plus aria-hidden className="size-4" /> Agregar línea
          </Button>
        </div>
        {lines.map((line, index) => {
          const material: RawMaterialView | undefined = materialMap.get(line.rawMaterialId);
          return (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <SelectField
                label={`Materia prima ${String(index + 1)}`}
                options={materialOptions}
                value={line.rawMaterialId}
                onChange={(e) => {
                  updateLine(index, { rawMaterialId: e.target.value });
                }}
              />
              <TextField
                label="Cantidad"
                type="number"
                min={0.001}
                step={0.001}
                inputMode="decimal"
                value={line.quantity}
                {...(material ? { hint: material.unit } : {})}
                onChange={(e) => {
                  updateLine(index, { quantity: e.target.value });
                }}
              />
              <TextField
                label="Costo unitario"
                type="number"
                min={0.0001}
                step={0.0001}
                inputMode="decimal"
                value={line.unitCost}
                {...(material ? { hint: `por ${material.unit}` } : {})}
                onChange={(e) => {
                  updateLine(index, { unitCost: e.target.value });
                }}
              />
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  aria-label={`Quitar línea ${String(index + 1)}`}
                  disabled={lines.length === 1}
                  onClick={() => {
                    setLines((current) => current.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-body text-ink-2">
          Total sin impuestos:{' '}
          <span className="font-mono text-title font-semibold text-ink">{formatMoney(total.toFixed(2))}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={create.isPending || materials.isPending || suppliers.isPending}>
            {create.isPending ? 'Registrando…' : 'Registrar compra'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
      <p className="text-caption text-ink-2">
        El total no incluye IVA ni retenciones: el desglose fiscal está pendiente de decisión (P-02). La
        compra no mueve el inventario hasta que se reciba.
      </p>
    </form>
  );
}
