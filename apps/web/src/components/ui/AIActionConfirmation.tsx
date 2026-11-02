import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './form';

/**
 * Confirmación explícita de una escritura propuesta por la IA (DEC-085, P-10).
 * Es solo presentación: el backend sigue exigiendo permiso, idempotencia y confirmación.
 * No se monta todavía porque el asistente se construye en la entrega 8.
 */
export function AIActionConfirmation({
  title = 'Requiere confirmación de escritura',
  rows,
  consequence,
  confirmLabel = 'Confirmar y guardar',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title?: string;
  rows: { label: string; value: ReactNode }[];
  consequence?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section aria-label={title} className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning"
        >
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-card font-semibold text-ink">{title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-2">
            <ShieldCheck aria-hidden className="size-3.5" />
            Nada se guarda hasta que lo confirmes.
          </p>
        </div>
      </div>
      <dl className="mt-4 space-y-2 border-t border-line pt-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4">
            <dt className="text-body text-ink-2">{row.label}</dt>
            <dd className="text-right text-body font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      {consequence ? <p className="mt-3 text-caption text-ink-2">{consequence}</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? 'Guardando…' : confirmLabel}
        </Button>
      </div>
    </section>
  );
}
