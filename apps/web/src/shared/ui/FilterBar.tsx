import type { ReactNode } from 'react';

/** Contenedor de filtros con una retícula estable: evita saltos al cambiar de criterio. */
export function FilterBar({
  children,
  label = 'Filtros',
  className = '',
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`rounded-2xl border border-line bg-surface p-4 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
