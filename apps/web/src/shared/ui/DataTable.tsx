import type { ReactNode } from 'react';

/**
 * Tabla con desplazamiento horizontal controlado. En móvil el contenedor es el único que
 * se desplaza; la página nunca lo hace (WCAG 1.4.10).
 */
export function DataTable({
  children,
  className = '',
  minWidth = '44rem',
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className={`w-full text-left ${className}`} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
