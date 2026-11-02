import type { MeResponse } from '@quatreros/contracts';
import { ChefHat, Clock3, CreditCard, ShoppingBag, Wallet } from 'lucide-react';
import { Badge } from '../../shared/ui/Badge';
import { Brand } from '../../shared/ui/Brand';
import { Card, CardLabel } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Button } from '../../shared/ui/form';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/**
 * Terminal POS (sistema de diseño Parte 2 §2): catálogo táctil a la izquierda, ticket a la derecha.
 * La venta se habilita con la entrega 6; mientras tanto, estados vacíos honestos.
 */
export function PosShell({ me }: { me: MeResponse }) {
  useDocumentTitle('Caja');
  const site = me.sites.find((s) => s.kind === 'point_of_sale') ?? me.sites[0];
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-header backdrop-blur-xl">
        <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6">
          <div className="flex flex-wrap items-center gap-2 md:gap-5">
            <Brand to="/" area="Caja" />
            {site ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-caption font-semibold whitespace-nowrap text-ink-2">
                <Wallet aria-hidden className="size-3.5 text-brand-ink" />
                {site.name}
              </span>
            ) : null}
            <Badge tone="neutral">
              <Clock3 aria-hidden className="size-3" />
              Turno cerrado
            </Badge>
            <span className="hidden sm:block">
              <ServerStatus />
            </span>
          </div>
          <UserMenu me={me} showName />
        </div>
      </header>

      <main className="grid content-start gap-4 p-4 md:grid-cols-[minmax(0,1fr)_22rem] md:content-stretch md:p-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section aria-labelledby="pos-catalogo" className="min-w-0">
          <Card className="flex h-full flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-caption font-semibold tracking-[0.12em] text-ink-3 uppercase">
                  Punto de venta
                </p>
                <h1 id="pos-catalogo" className="mt-1 font-display text-title font-bold text-ink">
                  Productos
                </h1>
                <p className="mt-1 text-body text-ink-2">Toca un producto para agregarlo al ticket.</p>
              </div>
              <Badge tone="info">Catálogo táctil</Badge>
            </div>

            <div className="mt-4 grid min-h-72 flex-1 place-items-center rounded-2xl border border-dashed border-line-strong bg-surface-2/60 p-6 text-center md:p-10">
              <EmptyState
                icon={<ShoppingBag className="size-5" />}
                title="El catálogo se activa con la entrega 6"
                description="Aquí aparecerán los productos con precio y existencias. Para vender, primero se abre un turno de caja."
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3.5">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-ink-2"
                >
                  <ChefHat className="size-4" />
                </span>
                <div>
                  <p className="text-body font-semibold text-ink">Monitor de cocina</p>
                  <p className="text-caption text-ink-2">
                    Conteos y merma teórica se activan con la entrega 6.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3.5">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-ink-2"
                >
                  <CreditCard className="size-4" />
                </span>
                <div>
                  <p className="text-body font-semibold text-ink">Pagos mixtos</p>
                  <p className="text-caption text-ink-2">
                    Efectivo, Nequi y tarjeta en una misma venta (POS-01).
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <aside aria-labelledby="pos-ticket" className="min-w-0 md:sticky md:top-[88px] md:self-start">
          <Card className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <h2 id="pos-ticket" className="font-display text-title font-bold text-ink">
                Venta actual
              </h2>
              <Badge tone="neutral">Sin turno</Badge>
            </div>

            <div className="mt-4 flex-1">
              <EmptyState
                compact
                icon={<ShoppingBag className="size-5" />}
                title="Sin productos en la venta"
                description="El ticket se llena al tocar productos del catálogo."
              />
            </div>

            <dl className="mt-6 space-y-2.5 border-t border-line pt-4">
              <div className="flex items-baseline justify-between">
                <dt className="text-body text-ink-2">Subtotal</dt>
                <dd className="tabular font-mono text-body text-ink">{cop.format(0)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>
                  <CardLabel as="p">Total a pagar</CardLabel>
                </dt>
                <dd className="tabular font-mono text-[1.75rem] leading-8 font-bold text-ink">
                  {cop.format(0)}
                </dd>
              </div>
            </dl>

            <Button className="mt-4 w-full" disabled>
              Cobrar e imprimir
            </Button>
            <p className="mt-2 text-center text-caption text-ink-3">
              Se habilita al abrir turno (entrega 6).
            </p>
          </Card>
        </aside>
      </main>
    </div>
  );
}
