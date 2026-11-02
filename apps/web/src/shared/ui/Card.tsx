import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Cards y contenedores bento (sistema de diseño §3.B, revisión v1.1).
 * La elevación es sutil; el hover solo cambia borde y sombra, y el movimiento se desactiva
 * con `prefers-reduced-motion` (Anexo A).
 */
export function Card({
  interactive = false,
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-200 ${interactive ? 'motion-safe:hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-float' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** Encabezado pequeño de card bento (Caption en mayúsculas sostenidas, como en los bocetos). */
export function CardLabel({ children, as: Tag = 'h2' }: { children: ReactNode; as?: 'h2' | 'h3' | 'p' }) {
  return <Tag className="text-caption font-semibold tracking-[0.12em] text-ink-2 uppercase">{children}</Tag>;
}
