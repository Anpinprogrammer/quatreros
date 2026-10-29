import type { MeResponse } from '@quatreros/contracts';
import { Link } from 'react-router';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

/** Shell POS (ADR-014): catálogo táctil a la izquierda, ticket y pagos a la derecha. */
export function PosShell({ me }: { me: MeResponse }) {
  useDocumentTitle('Caja');
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-surface">
      <header className="flex items-center justify-between border-b border-line bg-panel px-4 py-3">
        <Link to="/" className="font-bold text-chimichurri-strong">
          Quatreros <span className="ml-1 font-normal text-ink-muted">Caja</span>
        </Link>
        <div className="flex items-center gap-4">
          <ServerStatus />
          <UserMenu me={me} />
        </div>
      </header>
      <main className="grid gap-4 p-4 md:grid-cols-[1fr_20rem] lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="pos-catalogo" className="rounded-panel bg-panel p-4">
          <h1 id="pos-catalogo" className="text-xl font-bold">
            Productos
          </h1>
          <p className="mt-2 text-ink-muted">
            Para vender, primero se abre un turno. La venta se habilita con su módulo.
          </p>
        </section>
        <aside aria-labelledby="pos-ticket" className="rounded-panel bg-panel p-4">
          <h2 id="pos-ticket" className="text-xl font-bold">
            Venta actual
          </h2>
          <p className="mt-6 flex items-baseline justify-between border-t border-line pt-4 text-lg">
            <span>Total</span>
            <span className="tabular text-2xl font-bold">$0</span>
          </p>
        </aside>
      </main>
    </div>
  );
}
