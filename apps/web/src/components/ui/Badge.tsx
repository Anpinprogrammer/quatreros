import type { ReactNode } from 'react';
import { statusLabel, type ModuleStatus } from '../../config/modules';

/** Badges de estado (sistema de diseño §3.C) con semántica que se adapta a claro y oscuro. */
export type BadgeTone = 'danger' | 'warning' | 'info' | 'ember' | 'success' | 'neutral';

const tones: Record<BadgeTone, string> = {
  danger: 'bg-danger/10 text-danger border-danger/20',
  warning: 'bg-warning/10 text-warning border-warning/25',
  info: 'bg-info/10 text-info border-info/20',
  ember: 'bg-brand-soft text-brand-ink border-brand/25',
  success: 'bg-success/10 text-success border-success/20',
  neutral: 'bg-surface-2 text-ink-2 border-line-strong',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const statusTone: Record<ModuleStatus['kind'], BadgeTone> = {
  available: 'success',
  pending: 'neutral',
  blocked: 'warning',
};

/** Estado de un módulo con el mismo lenguaje visual en toda la aplicación. */
export function StatusBadge({ status }: { status: ModuleStatus }) {
  return (
    <Badge tone={statusTone[status.kind]}>
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          status.kind === 'available' ? 'bg-success' : status.kind === 'blocked' ? 'bg-warning' : 'bg-ink-3'
        }`}
      />
      {statusLabel(status)}
    </Badge>
  );
}
