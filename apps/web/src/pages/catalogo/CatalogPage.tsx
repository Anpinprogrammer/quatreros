import {
  BASE_UNIT_LABELS,
  PRODUCT_KIND_LABELS,
  ProductKind,
  type MeResponse,
  type ProductKind as ProductKindType,
  type ProductView,
  type RawMaterialView,
} from '@quatreros/contracts';
import { Package, Wheat } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { hasPermission } from '../../hooks/session';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterBar } from '../../components/ui/FilterBar';
import { Alert, Button, SelectField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useProducts, useRawMaterials } from '../../services/catalogo';
import { formatMoney, formatUnits } from '../../lib/format/catalogo';
import { ProductForm } from '../../components/catalogo/ProductForm';
import { RawMaterialForm } from '../../components/catalogo/RawMaterialForm';

type Tab = 'products' | 'raw';

const statusOptions = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
];

const kindOptions = [
  { value: '', label: 'Todos los tipos' },
  ...ProductKind.options.map((value) => ({ value, label: PRODUCT_KIND_LABELS[value] })),
];

/** Catálogo y precios (RF-030..032), dentro de 04. Producción (DEC-091). */
export function CatalogPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Catálogo y precios');
  const [tab, setTab] = useState<Tab>('products');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'products', label: 'Productos' },
    { id: 'raw', label: 'Materias primas' },
  ];

  return (
    <section aria-labelledby="catalogo-titulo" className="space-y-7">
      <PageHeader
        titleId="catalogo-titulo"
        eyebrow={
          <Link to="/erp/seccion/produccion" className="hover:text-ink">
            Producción · Catálogo
          </Link>
        }
        title="Catálogo y precios"
        description="Lo que se vende y lo que se compra: productos, presentaciones, precio vigente con histórico y materias primas. Los cambios quedan auditados."
      />

      <div role="tablist" aria-label="Catálogo" className="flex gap-1 border-b border-line">
        {tabs.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              id={`catalogo-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`catalogo-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={`-mb-px min-h-12 rounded-t-lg border-b-2 px-4 text-body font-semibold transition-colors duration-200 ${selected ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
              onClick={() => {
                setTab(t.id);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const index = tabs.findIndex((x) => x.id === tab);
                const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                if (!next) return;
                setTab(next.id);
                document.getElementById(`catalogo-tab-${next.id}`)?.focus();
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        id="catalogo-panel-products"
        role="tabpanel"
        aria-labelledby="catalogo-tab-products"
        hidden={tab !== 'products'}
      >
        {tab === 'products' ? <ProductsPanel me={me} /> : null}
      </div>
      <div id="catalogo-panel-raw" role="tabpanel" aria-labelledby="catalogo-tab-raw" hidden={tab !== 'raw'}>
        {tab === 'raw' ? <RawMaterialsPanel me={me} /> : null}
      </div>
    </section>
  );
}

type EditingProduct = { mode: 'create' } | { mode: 'edit'; product: ProductView } | null;

function ProductsPanel({ me }: { me: MeResponse }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ProductKindType | ''>('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<EditingProduct>(null);
  const toast = useToast();
  const canManage = hasPermission(me, 'cat.product.manage');
  const products = useProducts({ q, kind: kind || undefined, status });

  const closeForm = (message?: string) => {
    setEditing(null);
    if (message) toast.show(message);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const filtered = Boolean(q) || Boolean(kind) || status !== 'active';

  return (
    <section aria-labelledby="productos-titulo" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="productos-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-title font-bold text-ink outline-none"
          >
            Productos
          </h2>
          <p className="mt-1 text-body text-ink-2">
            {products.data
              ? `${String(products.data.data.length)}${products.data.page.nextCursor ? '+' : ''} en esta vista`
              : 'Presentaciones y precios vigentes'}
          </p>
        </div>
        {canManage && !editing ? (
          <Button
            onClick={() => {
              setEditing({ mode: 'create' });
            }}
          >
            Crear producto
          </Button>
        ) : null}
      </div>

      {editing ? (
        <ProductForm
          key={editing.mode === 'edit' ? editing.product.id : 'new'}
          {...(editing.mode === 'edit' ? { product: editing.product } : {})}
          onDone={closeForm}
          onCancel={() => {
            closeForm();
          }}
        />
      ) : null}

      <FilterBar>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <SearchInput
            label="Buscar producto"
            placeholder="Nombre del producto"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
          />
          <SelectField
            label="Tipo"
            options={kindOptions}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ProductKindType | '');
            }}
          />
          <SelectField
            label="Estado"
            options={statusOptions}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'active' | 'inactive' | 'all');
            }}
          />
        </div>
      </FilterBar>

      {products.isPending ? <LoadingSkeleton label="Cargando productos…" /> : null}
      {products.error ? <Alert>{products.error.message}</Alert> : null}
      {products.data?.data.length === 0 && !products.isPending ? (
        <EmptyState
          icon={<Package className="size-5" />}
          title={filtered ? 'Ningún producto coincide' : 'Todavía no hay productos'}
          description={
            filtered
              ? 'Prueba con otro nombre, tipo o estado.'
              : 'Crea el primero para empezar a vender y a construir el catálogo.'
          }
          action={
            !filtered && canManage ? (
              <Button
                onClick={() => {
                  setEditing({ mode: 'create' });
                }}
              >
                Crear producto
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {products.data && products.data.data.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.data.data.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                canManage={canManage}
                onEdit={() => {
                  setEditing({ mode: 'edit', product });
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {products.data?.page.nextCursor ? (
        <p className="text-caption text-ink-2">
          Hay más productos de los que caben en esta página. Usa la búsqueda para acotar.
        </p>
      ) : null}
    </section>
  );
}

function ProductCard({
  product,
  canManage,
  onEdit,
}: {
  product: ProductView;
  canManage: boolean;
  onEdit: () => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <Package className="size-4" />
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge tone={product.kind === 'manufactured' ? 'ember' : 'info'}>
            {PRODUCT_KIND_LABELS[product.kind]}
          </Badge>
          <Badge tone={product.isActive ? 'success' : 'neutral'}>
            {product.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </div>

      <Link
        to={`/erp/catalogo/productos/${product.id}`}
        className="mt-4 font-display text-card font-semibold text-ink transition-colors hover:text-brand-ink"
      >
        {product.name}
      </Link>
      <p className="mt-1.5 text-caption text-ink-2">
        Unidad base: <span className="text-ink">{BASE_UNIT_LABELS[product.baseUnit]}</span>
        {product.shelfLifeDays != null
          ? ` · Vida útil: ${String(product.shelfLifeDays)} días`
          : ' · Sin vencimiento'}
      </p>

      <ul className="mt-4 flex-1 space-y-2.5">
        {product.presentations.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line-strong px-3 py-3 text-caption text-ink-2">
            Sin presentaciones todavía.
          </li>
        ) : (
          product.presentations.map((presentation) => (
            <li
              key={presentation.id}
              className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5 first:border-0 first:pt-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-body font-semibold text-ink">{presentation.name}</span>
                <span className="block text-caption text-ink-2">
                  {formatUnits(presentation.unitsPer)}
                  {presentation.isActive ? '' : ' · inactiva'}
                </span>
              </span>
              {presentation.currentPrice ? (
                <span className="tabular shrink-0 font-mono text-body text-ink">
                  {formatMoney(presentation.currentPrice)}
                </span>
              ) : (
                <Badge tone="warning">Sin precio</Badge>
              )}
            </li>
          ))
        )}
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Link
          to={`/erp/catalogo/productos/${product.id}`}
          className="inline-flex min-h-10 items-center gap-1 text-body font-semibold text-brand-ink hover:text-ink"
        >
          Abrir ficha y precios <span aria-hidden>›</span>
        </Link>
        {canManage ? (
          <Button variant="secondary" aria-label={`Editar ${product.name}`} onClick={onEdit}>
            Editar
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

type EditingRaw = { mode: 'create' } | { mode: 'edit'; material: RawMaterialView } | null;

function RawMaterialsPanel({ me }: { me: MeResponse }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<EditingRaw>(null);
  const toast = useToast();
  const canManage = hasPermission(me, 'cat.raw_material.manage');
  const materials = useRawMaterials({ q, status });

  const closeForm = (message?: string) => {
    setEditing(null);
    if (message) toast.show(message);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <section aria-labelledby="materias-titulo" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="materias-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-title font-bold text-ink outline-none"
          >
            Materias primas
          </h2>
          <p className="mt-1 text-body text-ink-2">
            {materials.data
              ? `${String(materials.data.data.length)}${materials.data.page.nextCursor ? '+' : ''} en esta vista`
              : 'Insumos que alimentan la producción'}
          </p>
        </div>
        {canManage && !editing ? (
          <Button
            onClick={() => {
              setEditing({ mode: 'create' });
            }}
          >
            Crear materia prima
          </Button>
        ) : null}
      </div>

      {editing ? (
        <RawMaterialForm
          key={editing.mode === 'edit' ? editing.material.id : 'new'}
          {...(editing.mode === 'edit' ? { material: editing.material } : {})}
          onDone={closeForm}
          onCancel={() => {
            closeForm();
          }}
        />
      ) : null}

      <FilterBar>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SearchInput
            label="Buscar materia prima"
            placeholder="Nombre de la materia prima"
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
              setStatus(e.target.value as 'active' | 'inactive' | 'all');
            }}
          />
        </div>
      </FilterBar>

      {materials.isPending ? <LoadingSkeleton label="Cargando materias primas…" /> : null}
      {materials.error ? <Alert>{materials.error.message}</Alert> : null}
      {materials.data?.data.length === 0 && !materials.isPending ? (
        <EmptyState
          icon={<Wheat className="size-5" />}
          title={
            q || status !== 'active' ? 'Ninguna materia prima coincide' : 'Todavía no hay materias primas'
          }
          description={
            q || status !== 'active'
              ? 'Prueba con otro nombre o estado.'
              : 'Registra los insumos que consume la producción.'
          }
          action={
            !q && status === 'active' && canManage ? (
              <Button
                onClick={() => {
                  setEditing({ mode: 'create' });
                }}
              >
                Crear materia prima
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {materials.data && materials.data.data.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.data.data.map((material) => (
            <li key={material.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink-2"
                  >
                    <Wheat className="size-4" />
                  </span>
                  {canManage ? (
                    <Button
                      variant="secondary"
                      aria-label={`Editar ${material.name}`}
                      onClick={() => {
                        setEditing({ mode: 'edit', material });
                      }}
                    >
                      Editar
                    </Button>
                  ) : null}
                </div>
                <h3 className="mt-4 font-display text-card font-semibold text-ink">{material.name}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={material.isActive ? 'success' : 'neutral'}>
                    {material.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                  {material.tracksExpiry ? (
                    <Badge tone="warning">Controla vencimiento</Badge>
                  ) : (
                    <Badge tone="neutral">Sin vencimiento</Badge>
                  )}
                </div>
                <p className="mt-auto pt-4 text-body text-ink-2">
                  Unidad de inventario:{' '}
                  <span className="font-semibold text-ink">{BASE_UNIT_LABELS[material.unit]}</span>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {materials.data?.page.nextCursor ? (
        <p className="text-caption text-ink-2">
          Hay más materias primas de las que caben en esta página. Usa la búsqueda para acotar.
        </p>
      ) : null}
    </section>
  );
}
