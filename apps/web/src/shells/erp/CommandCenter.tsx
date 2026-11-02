import type { MeResponse } from '@quatreros/contracts';
import {
  CalendarClock,
  Calculator,
  CreditCard,
  Factory,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '../../shared/ui/Card';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ModuleCard } from '../../shared/ui/ModuleCard';
import { PageHeader } from '../../shared/ui/PageHeader';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { SECTIONS, isUsable } from '../../shared/modules';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const allModules = SECTIONS.flatMap((section) => section.modules);

function BentoTile({
  label,
  shows,
  delivery,
  icon,
  tone = 'neutral',
  className = '',
}: {
  label: string;
  shows: string;
  delivery: number;
  icon: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink-2">
          {icon}
        </span>
        <Badge tone={tone}>Entrega {delivery}</Badge>
      </div>
      <h3 className="mt-4 font-display text-card font-semibold text-ink">{label}</h3>
      <p className="mt-1.5 text-body text-ink-2">{shows}</p>
      <p className="mt-auto pt-4 text-caption text-ink-3">Se activa con la entrega {delivery}</p>
    </Card>
  );
}

/**
 * Command Center: lo que ya se puede hacer y el estado honesto de lo que falta.
 * No muestra cifras hasta que el módulo que las produce exista (Anexo B).
 */
export function CommandCenter({ me }: { me: MeResponse }) {
  useDocumentTitle('Command Center');
  const firstName = me.user.fullName.split(' ')[0] ?? me.user.fullName;
  const available = allModules.filter((module) => isUsable(module, me));
  const pending = allModules.filter((module) => module.status.kind === 'pending');
  const blocked = allModules.filter((module) => module.status.kind === 'blocked');
  const nextMilestones = pending
    .filter((module) => module.status.kind === 'pending')
    .sort((a, b) => {
      const da = a.status.kind === 'pending' ? a.status.delivery : 99;
      const db = b.status.kind === 'pending' ? b.status.delivery : 99;
      return da - db;
    })
    .slice(0, 3);

  return (
    <section aria-labelledby="inicio-titulo" className="space-y-8">
      <PageHeader
        titleId="inicio-titulo"
        eyebrow={
          <>
            <span>Hola, {firstName}</span>
            <span aria-hidden className="text-ink-3">
              ·
            </span>
            <span className="normal-case tracking-normal">{dateFormat.format(new Date())}</span>
          </>
        }
        title="Command Center"
        description="Tu punto de partida para operar producción, inventario, distribución y caja."
        meta={
          <span className="text-caption text-ink-2">
            Modo claro y oscuro · los módulos pendientes se señalan, no se simulan.
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="puedes-usar">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="puedes-usar" className="font-display text-title font-bold text-ink">
                  Puedes usar
                </h2>
                <p className="mt-1 text-body text-ink-2">
                  Accesos directos según tu rol y tus permisos actuales.
                </p>
              </div>
              <Badge tone={available.length > 0 ? 'success' : 'neutral'}>
                {available.length} {available.length === 1 ? 'módulo' : 'módulos'}
              </Badge>
            </div>
            {available.length > 0 ? (
              <ul className="grid gap-4 md:grid-cols-2">
                {available.map((module) => (
                  <li key={module.id}>
                    <ModuleCard module={module} me={me} headingLevel={3} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="Tu rol aún no tiene módulos operativos"
                description="Cuando tu administrador te asigne permisos, los accesos aparecerán aquí."
              />
            )}
          </section>

          <section aria-labelledby="tablero">
            <div className="mb-3">
              <h2 id="tablero" className="font-display text-title font-bold text-ink">
                Tablero del día
              </h2>
              <p className="mt-1 text-body text-ink-2">
                Indicadores que se activan a medida que avanza el prototipo.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <BentoTile
                label="Ventas del día"
                shows="Ventas de hoy en caja, comparadas con ayer."
                delivery={6}
                icon={<Calculator className="size-4" />}
              />
              <BentoTile
                label="Estado de reparto"
                shows="Pedidos entregados, en ruta y con entrega parcial."
                delivery={5}
                icon={<Truck className="size-4" />}
              />
              <BentoTile
                label="Producción y mermas"
                shows="Kilos producidos por producto y rendimiento promedio."
                delivery={4}
                icon={<Factory className="size-4" />}
              />
              <BentoTile
                label="Alertas FEFO y salida preferente"
                shows="Lotes próximos a vencer, con días restantes y paquetes en cada sede."
                delivery={2}
                tone="warning"
                icon={<CalendarClock className="size-4" />}
                className="md:col-span-2 xl:col-span-3"
              />
              <BentoTile
                label="Estado de caja POS"
                shows="Total por caja y por medio de pago del turno abierto."
                delivery={6}
                icon={<CreditCard className="size-4" />}
              />
              <BentoTile
                label="Crédito y cartera"
                shows="Clientes cerca o por encima de su cupo y saldos vencidos."
                delivery={7}
                icon={<CreditCard className="size-4" />}
              />
              <BentoTile
                label="Sugerencia de IA"
                shows="Recomendaciones del asistente, siempre con confirmación humana."
                delivery={8}
                tone="info"
                icon={<Sparkles className="size-4" />}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="font-display text-card font-semibold text-ink">Tu sesión</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-caption text-ink-2">Rol</dt>
                <dd className="mt-0.5 text-body font-semibold text-ink">
                  {me.roles.map((role) => role.name).join(', ')}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-ink-2">Sedes autorizadas</dt>
                <dd className="mt-0.5 text-body font-semibold text-ink">
                  {me.sites.length > 0 ? me.sites.map((site) => site.name).join(', ') : 'Sin sede asignada'}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-ink-2">Conexión</dt>
                <dd className="mt-1">
                  <ServerStatus />
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-card font-semibold text-ink">En el plan</h2>
              <LayoutGrid aria-hidden className="size-4 text-ink-3" />
            </div>
            <ul className="mt-4 space-y-3">
              {nextMilestones.map((module) => (
                <li key={module.id} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 font-mono text-[11px] font-semibold text-ink-2"
                  >
                    {module.status.kind === 'pending' ? module.status.delivery : '—'}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold text-ink">{module.name}</span>
                    <span className="block text-caption text-ink-2">
                      Entrega {module.status.kind === 'pending' ? module.status.delivery : '—'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Badge tone="success">
                {available.length} {available.length === 1 ? 'disponible' : 'disponibles'}
              </Badge>
              <Badge tone="neutral">{pending.length} en construcción</Badge>
              <Badge tone="warning">
                {blocked.length} {blocked.length === 1 ? 'bloqueado' : 'bloqueados'}
              </Badge>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
