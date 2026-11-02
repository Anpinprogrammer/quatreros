import { BellRing } from 'lucide-react';
import type { ReactNode } from 'react';

/** Notificación del centro de actividad. El tono acompaña la semántica del sistema. */
export function NotificationItem({
  title,
  description,
  time,
  icon,
  tone = 'info',
  unread = false,
}: {
  title: string;
  description?: string;
  time?: string;
  icon?: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  unread?: boolean;
}) {
  const tones = {
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  }[tone];
  return (
    <div className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-surface-2">
      <span aria-hidden className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${tones}`}>
        {icon ?? <BellRing className="size-4" />}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-body font-semibold text-ink">
          {title}
          {unread ? <span aria-label="Sin leer" className="size-1.5 rounded-full bg-brand" /> : null}
        </p>
        {description ? <p className="mt-0.5 text-caption text-ink-2">{description}</p> : null}
        {time ? <p className="mt-1 font-mono text-[11px] text-ink-3">{time}</p> : null}
      </div>
    </div>
  );
}
