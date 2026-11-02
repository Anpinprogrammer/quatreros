import {
  BASE_UNIT_LABELS,
  PRODUCT_KIND_LABELS,
  type MeResponse,
  type PresentationView,
} from '@quatreros/contracts';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { hasPermission } from '../../shared/auth/session';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { Alert, Button } from '../../shared/ui/form';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useProduct } from './api';
import { formatMoney, formatQuantity } from './format';
import { PriceForm } from './PriceForm';
import { PriceHistory } from './PriceHistory';
import { PresentationForm } from './PresentationForm';
import { ProductForm } from './ProductForm';

type Notice = { tone: 'success' | 'error'; text: string } | null;

/** Ficha de producto: presentaciones, precio vigente e histórico (RF-030, RF-032). */
export function ProductPage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const product = useProduct(id);
  const [editingProduct, setEditingProduct] = useState(false);
  const [addingPresentation, setAddingPresentation] = useState(false);
  const [editingPresentation, setEditingPresentation] = useState<PresentationView | null>(null);
  const [priceEditing, setPriceEditing] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const presentationsRef = useRef<HTMLHeadingElement>(null);
  const canManage = hasPermission(me, 'cat.product.manage');
  const canPrice = hasPermission(me, 'cat.price.update');
  useDocumentTitle(product.data?.name ?? 'Producto');

  const closePresentations = (message?: string) => {
    setAddingPresentation(false);
    setEditingPresentation(null);
    if (message) setNotice({ tone: 'success', text: message });
    requestAnimationFrame(() => presentationsRef.current?.focus());
  };

  return (
    <section aria-labelledby="producto-titulo">
      <Link
        to="/erp/catalogo"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ash uppercase hover:text-chalk"
      >
        <span aria-hidden>‹</span> Catálogo y precios
      </Link>

      {product.isPending ? <p className="mt-4 text-ash">Cargando producto…</p> : null}
      {product.error ? (
        <div className="mt-4">
          <Alert>{product.error.message}</Alert>
        </div>
      ) : null}

      {product.data ? (
        <>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 id="producto-titulo" className="text-display font-bold">
                {product.data.name}
              </h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={product.data.kind === 'manufactured' ? 'ember' : 'info'}>
                  {PRODUCT_KIND_LABELS[product.data.kind]}
                </Badge>
                <Badge tone={product.data.isActive ? 'success' : 'neutral'}>
                  {product.data.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <p className="mt-3 text-ash">
                Unidad base: <span className="text-chalk">{BASE_UNIT_LABELS[product.data.baseUnit]}</span>
                {product.data.shelfLifeDays != null
                  ? ` · Vida útil: ${String(product.data.shelfLifeDays)} días`
                  : ' · Sin vencimiento'}
              </p>
            </div>
            {canManage && !editingProduct ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setNotice(null);
                  setEditingProduct(true);
                }}
              >
                Editar producto
              </Button>
            ) : null}
          </div>

          {notice ? (
            <div className="mt-4">
              <Alert tone={notice.tone}>{notice.text}</Alert>
            </div>
          ) : null}

          {editingProduct ? (
            <ProductForm
              product={product.data}
              onDone={(message) => {
                setEditingProduct(false);
                setNotice({ tone: 'success', text: message });
              }}
              onCancel={() => {
                setEditingProduct(false);
              }}
            />
          ) : null}

          <section aria-labelledby="presentaciones-titulo" className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2
                id="presentaciones-titulo"
                ref={presentationsRef}
                tabIndex={-1}
                className="text-title font-semibold outline-none"
              >
                Presentaciones
              </h2>
              {canManage && !addingPresentation ? (
                <Button
                  onClick={() => {
                    setNotice(null);
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
              <p className="mt-6 text-ash">
                Este producto no tiene presentaciones. Agrega al menos la unidad y, si aplica, el paquete.
              </p>
            ) : null}

            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {product.data.presentations.map((presentation) => (
                <li key={presentation.id}>
                  <Card className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-title font-semibold">{presentation.name}</h3>
                        <p className="mt-1 text-caption text-ash">
                          {formatQuantity(presentation.unitsPer)} unidad(es) base
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={presentation.isActive ? 'success' : 'neutral'}>
                            {presentation.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                          {presentation.currentPrice ? null : <Badge tone="warning">Sin precio</Badge>}
                        </div>
                      </div>
                      <p className="text-right">
                        <span className="block text-caption tracking-wider text-ash uppercase">
                          Precio vigente
                        </span>
                        <span className="font-mono text-title text-chalk">
                          {presentation.currentPrice ? formatMoney(presentation.currentPrice) : '—'}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {canPrice ? (
                        <Button
                          aria-label={`Cambiar precio de ${presentation.name}`}
                          onClick={() => {
                            setNotice(null);
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
                            setNotice(null);
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
                          setNotice({ tone: 'success', text: message });
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
