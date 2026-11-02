import type { ReactNode } from 'react';

/**
 * Tabla con desplazamiento horizontal controlado. En móvil el contenedor es el único que
 * se desplaza; la página nunca lo hace (WCAG 1.4.10). El contenedor es enfocable para que
 * el desplazamiento con teclado sea posible (WCAG 2.1.1 / axe scrollable-region-focusable).
 */
export function DataTable({
  children,
  className = '',
  minWidth = '44rem',
  label = 'Tabla de datos',
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
  label?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="scroll-thin overflow-x-auto rounded-2xl border border-line bg-surface shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <table className={`w-full text-left ${className}`} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
