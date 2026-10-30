import type { ReactNode } from 'react';

/** C. Badges de estado (sistema de diseño §3.C), con la misma receta para cada semántica. */
export type BadgeTone = 'danger' | 'warning' | 'info' | 'ember' | 'success' | 'neutral';

const tones: Record<BadgeTone, string> = {
  danger: 'bg-red-500/10 text-red-400 border-red-500/20', // Lote vencido
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', // FEFO próximo / espera decisión
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20', // Entregado parcial
  ember: 'bg-orange-500/10 text-orange-400 border-orange-500/20', // Paquete abierto
  success: 'bg-green-500/10 text-green-400 border-green-500/20', // Disponible / entregado
  neutral: 'bg-grill text-ash border-grill-strong', // En construcción
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-caption font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
