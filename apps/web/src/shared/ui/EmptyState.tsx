import type { ReactNode } from 'react';

/**
 * Estado vacío honesto: dice qué falta, por qué y qué se puede hacer.
 * Se usa tanto para listas sin resultados como para módulos que aún no se activan.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-2/60 text-center ${compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10'}`}
    >
      {icon ? (
        <span
          aria-hidden
          className="grid size-11 place-items-center rounded-2xl bg-surface text-ink-2 shadow-card"
        >
          {icon}
        </span>
      ) : null}
      <p className="font-display text-card font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-body text-ink-2">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
