import {
  BASE_UNIT_LABELS,
  PRODUCT_KIND_LABELS,
  ProductKind,
  type MeResponse,
  type ProductKind as ProductKindType,
  type ProductView,
  type RawMaterialView,
} from '@quatreros/contracts';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { hasPermission } from '../../shared/auth/session';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { Alert, Button, SelectField, TextField } from '../../shared/ui/form';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useProducts, useRawMaterials } from './api';
import { formatMoney, formatQuantity } from './format';
import { ProductForm } from './ProductForm';
import { RawMaterialForm } from './RawMaterialForm';

type Tab = 'products' | 'raw';
type Notice = { tone: 'success' | 'error'; text: string } | null;

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
    <section aria-labelledby="catalogo-titulo">
      <Link
        to="/erp/seccion/produccion"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ash uppercase hover:text-chalk"
      >
        <span aria-hidden className="font-mono">
          04.
        </span>
        Producción
      </Link>
      <h1 id="catalogo-titulo" className="text-display font-bold">
        Catálogo y precios
      </h1>
      <p className="mt-2 max-w-3xl text-ash">
        Lo que se vende y lo que se compra: productos, presentaciones, precio vigente con histórico y materias
        primas. Los cambios de precio y de unidad quedan auditados.
      </p>

      <div role="tablist" aria-label="Catálogo" className="mt-6 flex gap-1 border-b border-grill">
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
              className={`min-h-12 border-b-2 px-4 text-body font-semibold transition-colors duration-200 ${selected ? 'border-ember text-chalk' : 'border-transparent text-ash hover:text-chalk'}`}
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
        className="mt-6"
      >
        {tab === 'products' ? <ProductsPanel me={me} /> : null}
      </div>
      <div
        id="catalogo-panel-raw"
        role="tabpanel"
        aria-labelledby="catalogo-tab-raw"
        hidden={tab !== 'raw'}
        className="mt-6"
      >
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
  const [notice, setNotice] = useState<Notice>(null);
  const canManage = hasPermission(me, 'cat.product.manage');
  const products = useProducts({ q, kind: kind || undefined, status });

  const closeForm = (message?: string) => {
    setEditing(null);
    if (message) setNotice({ tone: 'success', text: message });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <section aria-labelledby="productos-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="productos-titulo"
          ref={headingRef}
          tabIndex={-1}
          className="text-title font-semibold outline-none"
        >
          Productos
        </h2>
        {canManage && !editing ? (
          <Button
            onClick={() => {
              setNotice(null);
              setEditing({ mode: 'create' });
            }}
          >
            Crear producto
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      ) : null}

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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <TextField
          label="Buscar producto"
          type="search"
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

      {products.isPending ? <p className="mt-6 text-ash">Cargando productos…</p> : null}
      {products.error ? (
        <div className="mt-6">
          <Alert>{products.error.message}</Alert>
        </div>
      ) : null}
      {products.data?.data.length === 0 ? (
        <p className="mt-6 text-ash">
          {q || kind || status !== 'active'
            ? 'Ningún producto coincide con los filtros.'
            : 'Todavía no hay productos. Crea el primero para empezar a vender.'}
        </p>
      ) : null}

      {products.data && products.data.data.length > 0 ? (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.data.data.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                canManage={canManage}
                onEdit={() => {
                  setNotice(null);
                  setEditing({ mode: 'edit', product });
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {products.data?.page.nextCursor ? (
        <p className="mt-4 text-caption text-ash">
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
        <div className="min-w-0">
          <Link
            to={`/erp/catalogo/productos/${product.id}`}
            className="text-title font-semibold text-chalk hover:text-ember"
          >
            {product.name}
          </Link>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={product.kind === 'manufactured' ? 'ember' : 'info'}>
              {PRODUCT_KIND_LABELS[product.kind]}
            </Badge>
            <Badge tone={product.isActive ? 'success' : 'neutral'}>
              {product.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>
        {canManage ? (
          <Button variant="secondary" aria-label={`Editar ${product.name}`} onClick={onEdit}>
            Editar
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-caption text-ash">
        Unidad base: <span className="text-chalk">{BASE_UNIT_LABELS[product.baseUnit]}</span>
        {product.shelfLifeDays != null
          ? ` · Vida útil: ${String(product.shelfLifeDays)} días`
          : ' · Sin vencimiento'}
      </p>

      <ul className="mt-4 flex-1 space-y-2">
        {product.presentations.length === 0 ? (
          <li className="text-ash">Sin presentaciones todavía.</li>
        ) : (
          product.presentations.map((presentation) => (
            <li
              key={presentation.id}
              className="flex items-baseline justify-between gap-3 border-t border-grill pt-2 first:border-0 first:pt-0"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-chalk">{presentation.name}</span>
                <span className="block text-caption text-ash">
                  {formatQuantity(presentation.unitsPer)} unidad(es) base
                  {presentation.isActive ? '' : ' · inactiva'}
                </span>
              </span>
              {presentation.currentPrice ? (
                <span className="font-mono text-chalk">{formatMoney(presentation.currentPrice)}</span>
              ) : (
                <Badge tone="warning">Sin precio</Badge>
              )}
            </li>
          ))
        )}
      </ul>

      <div className="mt-4">
        <Link
          to={`/erp/catalogo/productos/${product.id}`}
          className="inline-flex min-h-11 items-center text-body font-semibold text-ember hover:text-chalk"
        >
          Abrir ficha y precios <span aria-hidden>›</span>
        </Link>
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
  const [notice, setNotice] = useState<Notice>(null);
  const canManage = hasPermission(me, 'cat.raw_material.manage');
  const materials = useRawMaterials({ q, status });

  const closeForm = (message?: string) => {
    setEditing(null);
    if (message) setNotice({ tone: 'success', text: message });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <section aria-labelledby="materias-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="materias-titulo"
          ref={headingRef}
          tabIndex={-1}
          className="text-title font-semibold outline-none"
        >
          Materias primas
        </h2>
        {canManage && !editing ? (
          <Button
            onClick={() => {
              setNotice(null);
              setEditing({ mode: 'create' });
            }}
          >
            Crear materia prima
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      ) : null}

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

      <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TextField
          label="Buscar materia prima"
          type="search"
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

      {materials.isPending ? <p className="mt-6 text-ash">Cargando materias primas…</p> : null}
      {materials.error ? (
        <div className="mt-6">
          <Alert>{materials.error.message}</Alert>
        </div>
      ) : null}
      {materials.data?.data.length === 0 ? (
        <p className="mt-6 text-ash">
          {q || status !== 'active'
            ? 'Ninguna materia prima coincide con los filtros.'
            : 'Todavía no hay materias primas.'}
        </p>
      ) : null}

      {materials.data && materials.data.data.length > 0 ? (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.data.data.map((material) => (
            <li key={material.id}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-title font-semibold">{material.name}</h3>
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
                  </div>
                  {canManage ? (
                    <Button
                      variant="secondary"
                      aria-label={`Editar ${material.name}`}
                      onClick={() => {
                        setNotice(null);
                        setEditing({ mode: 'edit', material });
                      }}
                    >
                      Editar
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 text-body text-ash">
                  Unidad de inventario: <span className="text-chalk">{BASE_UNIT_LABELS[material.unit]}</span>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {materials.data?.page.nextCursor ? (
        <p className="mt-4 text-caption text-ash">
          Hay más materias primas de las que caben en esta página. Usa la búsqueda para acotar.
        </p>
      ) : null}
    </section>
  );
}
