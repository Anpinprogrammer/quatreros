import { ArrowUpRight, Lock } from 'lucide-react';
import type { MeResponse } from '@quatreros/contracts';
import { Link } from 'react-router';
import { isUsable, type ModuleEntry } from '../../config/modules';
import { StatusBadge } from './Badge';
import { ModuleIcon } from './ModuleIcon';

/** Card de módulo: icono, nombre, descripción, estado real y una única acción clara. */
export function ModuleCard({
  module,
  me,
  headingLevel = 2,
  featured = false,
}: {
  module: ModuleEntry;
  me: MeResponse;
  headingLevel?: 2 | 3;
  featured?: boolean;
}) {
  const usable = isUsable(module, me);
  const availableWithoutPermission = module.status.kind === 'available' && !usable;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const statusHint = usable
    ? 'Abrir módulo'
    : availableWithoutPermission
      ? 'Sin permiso para este módulo'
      : module.status.kind === 'blocked'
        ? `Depende de la decisión ${module.status.by}`
        : module.status.kind === 'pending'
          ? `Se activa en la entrega ${String(module.status.delivery)}`
          : '';

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
            usable
              ? 'bg-brand-soft text-brand-ink'
              : module.status.kind === 'blocked'
                ? 'bg-warning/10 text-warning'
                : 'bg-surface-2 text-ink-2'
          }`}
        >
          <ModuleIcon name={module.icon} className="size-5" />
        </span>
        <StatusBadge status={module.status} />
      </div>
      <Heading
        className={`mt-4 font-display font-semibold text-ink ${featured ? 'text-title' : 'text-card'}`}
      >
        {module.name}
      </Heading>
      <p className="mt-1.5 text-body text-ink-2">{module.description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="text-caption font-medium text-ink-3">{statusHint}</span>
        <span
          aria-hidden
          className={`grid size-8 place-items-center rounded-full border ${
            usable ? 'border-brand/20 bg-brand-soft text-brand-ink' : 'border-line bg-surface-2 text-ink-3'
          }`}
        >
          {usable ? <ArrowUpRight className="size-4" /> : <Lock className="size-3.5" />}
        </span>
      </div>
    </>
  );

  if (usable && module.path) {
    return (
      <Link to={module.path} className="group block h-full rounded-2xl focus-visible:outline-offset-4">
        <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-200 motion-safe:group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-float">
          {body}
        </div>
      </Link>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card">
      {body}
    </div>
  );
}
