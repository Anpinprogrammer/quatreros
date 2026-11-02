import type { MeResponse } from '@quatreros/contracts';
import { Banknote, MapPinned, PackageCheck, Truck } from 'lucide-react';
import { Badge } from '../../shared/ui/Badge';
import { Brand } from '../../shared/ui/Brand';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

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
        <div>
          <p className="text-caption font-semibold tracking-[0.12em] text-ink-3 uppercase">Hoy</p>
          <h1 className="mt-1 font-display text-display font-bold text-ink">Rutas del día</h1>
          <p className="mt-1 text-body text-ink-2">
            Tus pedidos asignados, con dirección, total a cobrar y registro de entrega.
          </p>
        </div>

        <Card>
          <EmptyState
            icon={<Truck className="size-5" />}
            title="Aún no hay pedidos asignados"
            description="Cuando el despacho asigne tu ruta, verás cada pedido aquí con las acciones de llamar, ver mapa y registrar entrega o cobro."
            action={<Badge tone="neutral">Se activa con la entrega 5</Badge>}
          />
        </Card>

        <Card>
          <h2 className="font-display text-card font-semibold text-ink">Cómo funcionará tu ruta</h2>
          <ol className="mt-4 space-y-3">
            {[
              {
                icon: <PackageCheck className="size-4" />,
                title: 'Recibe el despacho',
                detail: 'Pedidos, cantidades y forma de cobro.',
              },
              {
                icon: <MapPinned className="size-4" />,
                title: 'Entrega en calle',
                detail: 'Entrega completa o parcial, con motivo si falta algo.',
              },
              {
                icon: <Banknote className="size-4" />,
                title: 'Registra el recaudo',
                detail: 'Efectivo, Nequi o crédito del cliente.',
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink"
                >
                  {step.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-ink">
                    {index + 1}. {step.title}
                  </span>
                  <span className="block text-caption text-ink-2">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-caption text-ink-3">
            La liquidación del repartidor depende de la decisión{' '}
            <span className="whitespace-nowrap">P-08</span> y no se muestra como si estuviera disponible.
          </p>
        </Card>
      </main>
    </div>
  );
}
