import type { MeResponse } from '@quatreros/contracts';
import { Brand } from '../../shared/ui/Brand';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { DriverDispatchPage } from '../../features/ventas/DriverDispatchPage';

const today = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});

/** Portal móvil de distribución (sistema de diseño Parte 2 §3): mobile-first, una columna. */
export function RutaShell({ me }: { me: MeResponse }) {
  useDocumentTitle('Distribución');
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-header px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <Brand to="/" area="Distribución" />
          <UserMenu me={me} compact />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-ink-2">
            Repartidor: <span className="font-semibold text-ink">{me.user.fullName}</span>
          </p>
          <ServerStatus />
        </div>
        <p className="mt-1 text-caption text-ink-3 first-letter:uppercase">{today.format(new Date())}</p>
      </header>
      <main className="space-y-4 px-4 py-5">
        <DriverDispatchPage me={me} />
      </main>
    </div>
  );
}
