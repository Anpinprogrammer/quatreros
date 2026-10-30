import type { MeResponse } from '@quatreros/contracts';
import { Badge } from '../../shared/ui/Badge';
import { Brand } from '../../shared/ui/Brand';
import { Card } from '../../shared/ui/Card';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

const today = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});

/** Portal móvil de distribución (sistema de diseño Parte 2 §3): mobile-first, una columna. */
export function RutaShell({ me }: { me: MeResponse }) {
  useDocumentTitle('Distribución');
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-char">
      <header className="border-b border-grill bg-smoke px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Brand to="/" area="Distribución" />
          <UserMenu me={me} compact />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-ash">
            Repartidor: <span className="font-semibold text-chalk">{me.user.fullName}</span> ·{' '}
            {today.format(new Date())}
          </p>
          <ServerStatus />
        </div>
      </header>
      <main className="px-4 py-5">
        <h1 className="text-title font-semibold">Rutas del día</h1>
        <Card className="mt-4">
          <p className="text-ash">
            Aquí verás tus pedidos asignados con cliente, dirección, total a cobrar y el botón para registrar
            la entrega o el cobro.
          </p>
          <div className="mt-4">
            <Badge>Se activa con la entrega 5</Badge>
          </div>
        </Card>
      </main>
    </div>
  );
}
