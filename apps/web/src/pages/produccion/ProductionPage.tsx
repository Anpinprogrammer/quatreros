import {
  PRODUCTION_ORDER_STATUS_LABELS,
  type MeResponse,
  type ProductionOrderStatus,
  type RecipeSummary,
} from '@quatreros/contracts';
import { ClipboardList, Factory, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { hasPermission } from '../../lib/session';
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
import { useProducts, useRawMaterials } from '../../services/catalogo';
import {
  useCreateOrder,
  useCreateRecipe,
  useOrders,
  useProductionPreview,
  useRecipes,
} from '../../services/produccion';
import { formatPercent, formatQuantity } from '../../lib/format/produccion';

type Tab = 'orders' | 'recipes';

const statusTones: Record<ProductionOrderStatus, BadgeTone> = {
  planned: 'warning',
  in_progress: 'info',
  closed: 'success',
};

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...(['planned', 'in_progress', 'closed'] as const).map((value) => ({
    value,
    label: PRODUCTION_ORDER_STATUS_LABELS[value],
  })),
];

/** Producción: órdenes y recetas (RF-033, RF-081..083). */
export function ProductionPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Producción');
  const [tab, setTab] = useState<Tab>('orders');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders', label: 'Órdenes' },
    { id: 'recipes', label: 'Recetas' },
  ];

  return (
    <section aria-labelledby="produccion-titulo" className="space-y-7">
      <PageHeader
        titleId="produccion-titulo"
        eyebrow={
          <Link to="/erp/seccion/produccion" className="hover:text-ink">
            Producción
          </Link>
        }
        title="Órdenes de producción"
        description="Convierte materia prima en producto terminado: receta versionada, consumo por lote y cierre con rendimiento."
      />

      <div role="tablist" aria-label="Producción" className="flex gap-1 border-b border-line">
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              id={`produccion-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`produccion-panel-${item.id}`}
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
                document.getElementById(`produccion-tab-${next.id}`)?.focus();
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id="produccion-panel-orders"
        role="tabpanel"
        aria-labelledby="produccion-tab-orders"
        hidden={tab !== 'orders'}
      >
        {tab === 'orders' ? <OrdersPanel me={me} /> : null}
      </div>
      <div
        id="produccion-panel-recipes"
        role="tabpanel"
        aria-labelledby="produccion-tab-recipes"
        hidden={tab !== 'recipes'}
      >
        {tab === 'recipes' ? <RecipesPanel me={me} /> : null}
      </div>
    </section>
  );
}

function OrdersPanel({ me }: { me: MeResponse }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<'' | ProductionOrderStatus>('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const canCreate = hasPermission(me, 'prod.order.create');
  const orders = useOrders({ status: status || undefined, q, limit: 100 });
  const navigate = useNavigate();

  const closeForm = (message?: string, id?: string) => {
    setCreating(false);
    if (message) toast.show(message);
    if (id) void navigate(`/erp/produccion/${id}`);
    else requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <section aria-labelledby="ordenes-titulo" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="ordenes-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-title font-bold text-ink outline-none"
          >
            Órdenes
          </h2>
          <p className="mt-1 text-body text-ink-2">
            La orden se planifica; el inventario cambia al registrar el consumo y el cierre.
          </p>
        </div>
        {canCreate && !creating ? (
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden className="size-4" /> Nueva orden
          </Button>
        ) : null}
      </div>

      {creating ? (
        <CreateOrderForm
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
            label="Buscar orden"
            placeholder="Número o producto"
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
              setStatus(e.target.value as '' | ProductionOrderStatus);
            }}
          />
        </div>
      </FilterBar>

      {orders.isPending ? <LoadingSkeleton label="Cargando órdenes…" rows={2} /> : null}
      {orders.error ? <Alert>{orders.error.message}</Alert> : null}
      {orders.data && orders.data.data.length === 0 ? (
        <EmptyState
          icon={<Factory className="size-5" />}
          title={q || status ? 'Ninguna orden coincide' : 'Sin órdenes'}
          description={
            q || status
              ? 'Prueba con otro número, producto o estado.'
              : 'Crea la primera orden de producción para transformar materia prima.'
          }
          action={
            !q && !status && canCreate ? (
              <Button
                onClick={() => {
                  setCreating(true);
                }}
              >
                Crear orden
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {orders.data && orders.data.data.length > 0 ? (
        <DataTable minWidth="64rem" label="Órdenes de producción">
          <caption className="sr-only">Órdenes de producción por número, producto, sede y estado</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Orden
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Producto
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Sede
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Planificado
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Real
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Rendimiento
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.data.data.map((order) => (
              <tr key={order.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link
                    to={`/erp/produccion/${order.id}`}
                    className="font-mono text-brand-ink hover:text-ink"
                  >
                    {order.number}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <span className="block text-ink">{order.productName}</span>
                  <span className="text-caption text-ink-2">Receta v{order.recipeVersion}</span>
                </td>
                <td className="px-3 py-3 text-ink-2">{order.siteName}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatQuantity(order.plannedQty)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {order.actualQty ? formatQuantity(order.actualQty) : '—'}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {order.yieldPct ? formatPercent(order.yieldPct) : '—'}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={statusTones[order.status]}>
                    {PRODUCTION_ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}

function CreateOrderForm({
  me,
  onDone,
  onCancel,
}: {
  me: MeResponse;
  onDone: (message: string, id: string) => void;
  onCancel: () => void;
}) {
  const products = useProducts({ status: 'active', kind: 'manufactured' });
  const recipes = useRecipes({ limit: 100 });
  const create = useCreateOrder();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [productId, setProductId] = useState('');
  const [siteId, setSiteId] = useState(me.sites[0]?.id ?? '');
  const [plannedQty, setPlannedQty] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const error = create.error as ApiError | null;
  const preview = useProductionPreview({
    productId,
    siteId,
    plannedQty: /^\d{1,11}(\.\d{1,3})?$/.test(plannedQty) && Number(plannedQty) > 0 ? plannedQty : undefined,
  });
  const recipe = recipes.data?.data.find((item) => item.productId === productId);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (!productId || !siteId) {
      setLocalError('Selecciona el producto y la sede.');
      return;
    }
    if (!/^\d{1,11}(\.\d{1,3})?$/.test(plannedQty) || Number(plannedQty) <= 0) {
      setLocalError('La cantidad planificada debe ser mayor que 0, con hasta 3 decimales.');
      return;
    }
    create.mutate(
      { input: { productId, siteId, plannedQty }, idempotencyKey },
      {
        onSuccess: (response) => {
          onDone(`Orden ${response.data.number} creada.`, response.data.id);
        },
      },
    );
  };

  const insufficient = preview.data?.theoreticalConsumption.some((line) => !line.sufficient);

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label="Nueva orden de producción"
    >
      <h3 className="font-display text-title font-bold text-ink">Nueva orden de producción</h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <SelectField
          label="Producto"
          options={[
            { value: '', label: 'Selecciona el producto' },
            ...(products.data?.data ?? []).map((product) => ({
              value: product.id,
              label: product.name,
            })),
          ]}
          value={productId}
          error={error?.fieldError('productId')}
          onChange={(e) => {
            setProductId(e.target.value);
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
          label="Cantidad planificada"
          type="number"
          min={0.001}
          step={0.001}
          inputMode="decimal"
          value={plannedQty}
          hint="En unidad base del producto."
          error={error?.fieldError('plannedQty')}
          onChange={(e) => {
            setPlannedQty(e.target.value);
          }}
        />
      </div>

      {recipe ? (
        <p className="text-caption text-ink-2">
          Receta vigente v{recipe.currentVersion.version} · produce{' '}
          {formatQuantity(recipe.currentVersion.baseOutputQty)} {recipe.baseUnit} base · rendimiento esperado{' '}
          {formatPercent(recipe.currentVersion.expectedYieldPct)} ±{' '}
          {formatPercent(recipe.currentVersion.tolerancePct)}
        </p>
      ) : productId ? (
        <Alert tone="info">El producto no tiene receta de producción vigente.</Alert>
      ) : null}

      {preview.isPending && plannedQty ? (
        <p className="text-body text-ink-2">Calculando consumo teórico…</p>
      ) : null}
      {preview.error ? <Alert>{preview.error.message}</Alert> : null}
      {preview.data ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[36rem] text-body">
            <caption className="sr-only">Consumo teórico y disponibilidad</caption>
            <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Materia prima
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Teórico
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Disponible
                </th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Alcanza
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.data.theoreticalConsumption.map((line) => (
                <tr key={line.rawMaterialId} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    {line.rawMaterialName} <span className="text-caption text-ink-2">({line.unit})</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatQuantity(line.theoreticalQuantity)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatQuantity(line.availableQuantity)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={line.sufficient ? 'success' : 'warning'}>
                      {line.sufficient ? 'Sí' : 'No'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {insufficient ? (
            <p className="border-t border-line px-3 py-2 text-caption text-warning">
              Falta materia prima. Puedes crear la orden, pero el consumo no podrá completarse hasta que haya
              existencia.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={create.isPending || products.isPending}>
          {create.isPending ? 'Creando…' : 'Crear orden'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function RecipesPanel({ me }: { me: MeResponse }) {
  const [creating, setCreating] = useState(false);
  const recipes = useRecipes({ limit: 100 });
  const canManage = hasPermission(me, 'prod.recipe.manage');
  const toast = useToast();

  return (
    <section aria-labelledby="recetas-titulo" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="recetas-titulo" className="font-display text-title font-bold text-ink">
            Recetas
          </h2>
          <p className="mt-1 text-body text-ink-2">
            Una receta por producto fabricado. Cada publicación crea una versión nueva e inmutable.
          </p>
        </div>
        {canManage && !creating ? (
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden className="size-4" /> Nueva receta
          </Button>
        ) : null}
      </div>

      {creating ? (
        <RecipeForm
          existing={recipes.data?.data ?? []}
          onDone={(message) => {
            setCreating(false);
            toast.show(message);
          }}
          onCancel={() => {
            setCreating(false);
          }}
        />
      ) : null}

      {recipes.isPending ? <LoadingSkeleton label="Cargando recetas…" rows={2} /> : null}
      {recipes.error ? <Alert>{recipes.error.message}</Alert> : null}
      {recipes.data && recipes.data.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="Sin recetas"
          description="Crea una receta para poder planificar producción."
        />
      ) : null}
      {recipes.data && recipes.data.data.length > 0 ? (
        <DataTable minWidth="56rem" label="Recetas de producción">
          <caption className="sr-only">Recetas de producción vigentes</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Producto
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Versión
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Producción base
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Rendimiento
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Tolerancia
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {recipes.data.data.map((recipe) => (
              <tr key={recipe.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3 font-semibold text-ink">{recipe.productName}</td>
                <td className="px-3 py-3 font-mono">v{recipe.currentVersion.version}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatQuantity(recipe.currentVersion.baseOutputQty)} {recipe.baseUnit}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatPercent(recipe.currentVersion.expectedYieldPct)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  ± {formatPercent(recipe.currentVersion.tolerancePct)}
                </td>
                <td className="px-3 py-3 text-right">
                  <Link
                    to={`/erp/produccion/recetas/${recipe.id}`}
                    className="inline-flex min-h-10 items-center font-semibold text-brand-ink hover:text-ink"
                  >
                    Abrir receta
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}

interface RecipeLineDraft {
  rawMaterialId: string;
  quantity: string;
}

function RecipeForm({
  existing,
  onDone,
  onCancel,
}: {
  existing: RecipeSummary[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const products = useProducts({ status: 'active', kind: 'manufactured' });
  const materials = useRawMaterials({ status: 'active' });
  const create = useCreateRecipe();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [productId, setProductId] = useState('');
  const [baseOutputQty, setBaseOutputQty] = useState('100.000');
  const [expectedYieldPct, setExpectedYieldPct] = useState('100.00');
  const [tolerancePct, setTolerancePct] = useState('3.00');
  const [lines, setLines] = useState<RecipeLineDraft[]>([{ rawMaterialId: '', quantity: '' }]);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = create.error as ApiError | null;
  const used = new Set(existing.map((recipe) => recipe.productId));
  const availableProducts = (products.data?.data ?? []).filter((product) => !used.has(product.id));

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (!productId) {
      setLocalError('Selecciona el producto.');
      return;
    }
    for (const line of lines) {
      if (!line.rawMaterialId) {
        setLocalError('Selecciona la materia prima de cada ingrediente.');
        return;
      }
      if (!/^\d{1,11}(\.\d{1,3})?$/.test(line.quantity) || Number(line.quantity) <= 0) {
        setLocalError('Cada cantidad debe ser mayor que 0, con hasta 3 decimales.');
        return;
      }
    }
    create.mutate(
      {
        input: { productId, baseOutputQty, expectedYieldPct, tolerancePct, lines },
        idempotencyKey,
      },
      {
        onSuccess: () => {
          onDone('Receta creada.');
        },
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label="Nueva receta"
    >
      <h3 className="font-display text-title font-bold text-ink">Nueva receta de producción</h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-4">
        <SelectField
          label="Producto fabricado"
          options={[
            { value: '', label: 'Selecciona el producto' },
            ...availableProducts.map((product) => ({ value: product.id, label: product.name })),
          ]}
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
          }}
        />
        <TextField
          label="Producción base"
          type="number"
          min={0.001}
          step={0.001}
          value={baseOutputQty}
          hint="Unidad base que produce la receta."
          onChange={(e) => {
            setBaseOutputQty(e.target.value);
          }}
        />
        <TextField
          label="Rendimiento esperado %"
          type="number"
          min={0.01}
          max={100}
          step={0.01}
          value={expectedYieldPct}
          onChange={(e) => {
            setExpectedYieldPct(e.target.value);
          }}
        />
        <TextField
          label="Tolerancia %"
          type="number"
          min={0}
          step={0.01}
          value={tolerancePct}
          onChange={(e) => {
            setTolerancePct(e.target.value);
          }}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-body font-semibold text-ink">Ingredientes por producción base</h4>
          <Button
            variant="secondary"
            onClick={() => {
              setLines((current) => [...current, { rawMaterialId: '', quantity: '' }]);
            }}
          >
            <Plus aria-hidden className="size-4" /> Agregar
          </Button>
        </div>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
          >
            <SelectField
              label={`Ingrediente ${String(index + 1)}`}
              options={[
                { value: '', label: 'Selecciona la materia prima' },
                ...(materials.data?.data ?? []).map((material) => ({
                  value: material.id,
                  label: `${material.name} (${material.unit})`,
                })),
              ]}
              value={line.rawMaterialId}
              onChange={(e) => {
                setLines((current) =>
                  current.map((item, i) => (i === index ? { ...item, rawMaterialId: e.target.value } : item)),
                );
              }}
            />
            <TextField
              label="Cantidad"
              type="number"
              min={0.001}
              step={0.001}
              value={line.quantity}
              onChange={(e) => {
                setLines((current) =>
                  current.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)),
                );
              }}
            />
            <div className="flex items-end">
              <Button
                variant="ghost"
                aria-label={`Quitar ingrediente ${String(index + 1)}`}
                disabled={lines.length === 1}
                onClick={() => {
                  setLines((current) => current.filter((_, i) => i !== index));
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear receta'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
