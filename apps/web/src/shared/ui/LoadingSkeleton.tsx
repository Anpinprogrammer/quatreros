/** Esqueleto de carga con la misma retícula del contenido para evitar saltos visuales. */
export function LoadingSkeleton({ label = 'Cargando…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} aria-hidden className="animate-pulse rounded-2xl border border-line bg-surface p-5">
            <div className="h-3 w-24 rounded-full bg-surface-3" />
            <div className="mt-4 h-5 w-3/4 rounded-full bg-surface-3" />
            <div className="mt-3 h-3 w-full rounded-full bg-surface-3" />
            <div className="mt-2 h-3 w-2/3 rounded-full bg-surface-3" />
            <div className="mt-6 h-10 w-full rounded-xl bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
