import type { MeResponse } from '@quatreros/contracts';
import { Badge } from '../../shared/ui/Badge';
import { Brand } from '../../shared/ui/Brand';
import { Card, CardLabel } from '../../shared/ui/Card';
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
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-char">
      <header className="border-b border-grill bg-smoke">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Brand to="/" area="Caja" />
            {site ? (
              <p className="rounded-lg border border-grill-strong bg-grill px-3 py-1.5 text-caption text-ash">
                Sede: <span className="font-semibold text-chalk">{site.name}</span>
              </p>
            ) : null}
            <ServerStatus />
          </div>
          <UserMenu me={me} />
        </div>
      </header>
      <main className="grid content-start gap-4 p-4 md:grid-cols-[1fr_22rem] md:content-stretch xl:grid-cols-[1fr_26rem]">
        <section aria-labelledby="pos-catalogo">
          <Card className="flex h-full flex-col">
            <h1 id="pos-catalogo" className="text-title font-semibold">
              Productos
            </h1>
            <div className="mt-4 grid min-h-64 flex-1 place-items-center rounded-2xl border border-dashed border-grill-strong p-8 text-center">
              <div>
                <p className="text-ash">
                  Aquí aparece el catálogo táctil con precio y existencias. Para vender, primero se abre un
                  turno.
                </p>
                <div className="mt-4">
                  <Badge>Se activa con la entrega 6</Badge>
                </div>
              </div>
            </div>
          </Card>
        </section>
        <aside aria-labelledby="pos-ticket">
          <Card className="flex h-full flex-col">
            <h2 id="pos-ticket" className="text-title font-semibold">
              Venta actual
            </h2>
            <p className="mt-4 text-ash md:flex-1">Sin productos en la venta.</p>
            <dl className="mt-6 space-y-2 border-t border-grill pt-4">
              <div className="flex items-baseline justify-between">
                <dt className="text-ash">Subtotal</dt>
                <dd className="font-mono">{cop.format(0)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>
                  <CardLabel as="p">Total a pagar</CardLabel>
                </dt>
                <dd className="font-mono text-display font-bold">{cop.format(0)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </main>
    </div>
  );
}
