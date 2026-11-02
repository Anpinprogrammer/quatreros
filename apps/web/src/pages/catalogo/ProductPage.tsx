import {
  BASE_UNIT_LABELS,
  PRODUCT_KIND_LABELS,
  type MeResponse,
  type PresentationView,
} from '@quatreros/contracts';
import { Package, Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { hasPermission } from '../../lib/session';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useProduct } from '../../services/catalogo';
import { formatMoney, formatUnits } from '../../lib/format/catalogo';
import { PriceForm } from '../../components/catalogo/PriceForm';
import { PriceHistory } from '../../components/catalogo/PriceHistory';
import { PresentationForm } from '../../components/catalogo/PresentationForm';
import { ProductForm } from '../../components/catalogo/ProductForm';

/** Ficha de producto: presentaciones, precio vigente e histórico (RF-030, RF-032). */
export function ProductPage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const product = useProduct(id);
  const toast = useToast();
  const [editingProduct, setEditingProduct] = useState(false);
  const [addingPresentation, setAddingPresentation] = useState(false);
  const [editingPresentation, setEditingPresentation] = useState<PresentationView | null>(null);
  const [priceEditing, setPriceEditing] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const presentationsRef = useRef<HTMLHeadingElement>(null);
  const canManage = hasPermission(me, 'cat.product.manage');
  const canPrice = hasPermission(me, 'cat.price.update');
  useDocumentTitle(product.data?.name ?? 'Producto');

  const closePresentations = (message?: string) => {
    setAddingPresentation(false);
    setEditingPresentation(null);
    if (message) toast.show(message);
    requestAnimationFrame(() => presentationsRef.current?.focus());
  };

  return (
    <section aria-labelledby="producto-titulo" className="space-y-7">
      <Link
        to="/erp/catalogo"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-[0.12em] text-ink-2 uppercase hover:text-ink"
      >
        <span aria-hidden>‹</span> Catálogo y precios
      </Link>

      {product.isPending ? <LoadingSkeleton label="Cargando producto…" rows={2} /> : null}
      {product.error ? <Alert>{product.error.message}</Alert> : null}

      {product.data ? (
        <>
          <PageHeader
            titleId="producto-titulo"
            eyebrow="Ficha de producto"
            title={product.data.name}
            meta={
              <>
                <Badge tone={product.data.kind === 'manufactured' ? 'ember' : 'info'}>
                  {PRODUCT_KIND_LABELS[product.data.kind]}
                </Badge>
                <Badge tone={product.data.isActive ? 'success' : 'neutral'}>
                  {product.data.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </>
            }
            actions={
              canManage && !editingProduct ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingProduct(true);
                  }}
                >
                  <Pencil aria-hidden className="size-4" />
                  Editar producto
                </Button>
              ) : null
            }
          />

          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <dt className="text-caption text-ink-2">Unidad base</dt>
              <dd className="mt-1 text-body font-semibold text-ink">
                {BASE_UNIT_LABELS[product.data.baseUnit]}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <dt className="text-caption text-ink-2">Vida útil</dt>
              <dd className="mt-1 text-body font-semibold text-ink">
                {product.data.shelfLifeDays != null
                  ? `${String(product.data.shelfLifeDays)} días`
                  : 'Sin vencimiento'}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <dt className="text-caption text-ink-2">Presentaciones</dt>
              <dd className="tabular mt-1 font-mono text-body font-semibold text-ink">
                {product.data.presentations.length}
              </dd>
            </div>
          </dl>

          {editingProduct ? (
            <ProductForm
              product={product.data}
              onDone={(message) => {
                setEditingProduct(false);
                toast.show(message);
              }}
              onCancel={() => {
                setEditingProduct(false);
              }}
            />
          ) : null}

          <section aria-labelledby="presentaciones-titulo">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2
                  id="presentaciones-titulo"
                  ref={presentationsRef}
                  tabIndex={-1}
                  className="font-display text-title font-bold text-ink outline-none"
                >
                  Presentaciones
                </h2>
                <p className="mt-1 text-body text-ink-2">
                  Cada presentación tiene su precio vigente y su histórico auditado.
                </p>
              </div>
              {canManage && !addingPresentation ? (
                <Button
                  onClick={() => {
                    setAddingPresentation(true);
                  }}
                >
                  Agregar presentación
                </Button>
              ) : null}
            </div>

            {addingPresentation ? (
              <PresentationForm
                productId={product.data.id}
                onDone={closePresentations}
                onCancel={() => {
                  closePresentations();
                }}
              />
            ) : null}

            {product.data.presentations.length === 0 && !addingPresentation ? (
              <div className="mt-5">
                <EmptyState
                  icon={<Package className="size-5" />}
                  title="Este producto no tiene presentaciones"
                  description="Agrega al menos la unidad y, si aplica, el paquete con su cantidad fija."
                />
              </div>
            ) : null}

            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {product.data.presentations.map((presentation) => (
                <li key={presentation.id}>
                  <Card className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-card font-semibold text-ink">{presentation.name}</h3>
                        <p className="mt-1 text-caption text-ink-2">{formatUnits(presentation.unitsPer)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={presentation.isActive ? 'success' : 'neutral'}>
                            {presentation.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                          {presentation.currentPrice ? null : <Badge tone="warning">Sin precio</Badge>}
                        </div>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="block text-caption tracking-[0.08em] text-ink-2 uppercase">
                          Precio vigente
                        </span>
                        <span className="tabular mt-1 block font-mono text-title font-semibold text-ink">
                          {presentation.currentPrice ? formatMoney(presentation.currentPrice) : '—'}
                        </span>
                      </p>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
                      {canPrice ? (
                        <Button
                          aria-label={`Cambiar precio de ${presentation.name}`}
                          onClick={() => {
                            setPriceEditing(priceEditing === presentation.id ? null : presentation.id);
                          }}
                        >
                          {presentation.currentPrice ? 'Cambiar precio' : 'Fijar precio'}
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button
                          variant="secondary"
                          aria-label={`Editar ${presentation.name}`}
                          onClick={() => {
                            setEditingPresentation(
                              editingPresentation?.id === presentation.id ? null : presentation,
                            );
                          }}
                        >
                          Editar
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        aria-expanded={historyOpen === presentation.id}
                        aria-label={`Ver histórico de precios de ${presentation.name}`}
                        onClick={() => {
                          setHistoryOpen(historyOpen === presentation.id ? null : presentation.id);
                        }}
                      >
                        {historyOpen === presentation.id ? 'Ocultar histórico' : 'Ver histórico'}
                      </Button>
                    </div>

                    {priceEditing === presentation.id ? (
                      <PriceForm
                        presentation={presentation}
                        onDone={(message) => {
                          setPriceEditing(null);
                          toast.show(message);
                        }}
                        onCancel={() => {
                          setPriceEditing(null);
                        }}
                      />
                    ) : null}

                    {editingPresentation?.id === presentation.id ? (
                      <PresentationForm
                        productId={product.data.id}
                        presentation={editingPresentation}
                        onDone={closePresentations}
                        onCancel={() => {
                          closePresentations();
                        }}
                      />
                    ) : null}

                    {historyOpen === presentation.id ? (
                      <PriceHistory presentationId={presentation.id} />
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}
