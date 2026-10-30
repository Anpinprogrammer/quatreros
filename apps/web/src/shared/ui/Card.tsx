import type { HTMLAttributes, ReactNode } from 'react';

/**
 * B. Cards y contenedores bento (sistema de diseño §3.B).
 * `interactive` agrega el realce de borde Ember y el desplazamiento de 2 px (sin movimiento si el
 * usuario pide reducirlo; Anexo A).
 */
export function Card({
  interactive = false,
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-grill bg-smoke p-5 shadow-xl transition-all duration-200 ${interactive ? 'hover:border-ember/50 motion-safe:hover:-translate-y-0.5' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** Encabezado pequeño de card bento (Caption en mayúsculas sostenidas, como en los bocetos). */
export function CardLabel({ children, as: Tag = 'h2' }: { children: ReactNode; as?: 'h2' | 'h3' | 'p' }) {
  return <Tag className="text-caption font-semibold tracking-wider text-ash uppercase">{children}</Tag>;
}
