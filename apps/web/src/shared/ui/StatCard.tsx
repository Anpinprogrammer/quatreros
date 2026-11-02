import type { ReactNode } from 'react';
import { Card } from './Card';

/**
 * Indicador operativo. Si no existe una fuente real para el dato, se usa "—" y se explica
 * qué entrega lo activa: nunca se inventan cifras (Anexo B del sistema de diseño).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning';
}) {
  const iconTone = {
    neutral: 'bg-surface-2 text-ink-2',
    brand: 'bg-brand-soft text-brand-ink',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  }[tone];
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-semibold tracking-[0.08em] text-ink-2 uppercase">{label}</p>
        <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>
          {icon}
        </span>
      </div>
      <p className="tabular mt-3 font-display text-[1.75rem] leading-8 font-bold text-ink">{value}</p>
      <p className="mt-1.5 text-caption leading-4 text-ink-2">{hint}</p>
    </Card>
  );
}
