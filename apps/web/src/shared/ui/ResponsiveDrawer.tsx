import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Panel deslizante para navegación móvil y filtros. Atrapa el foco, cierra con Escape,
 * bloquea el scroll del fondo y devuelve el foco al elemento que lo abrió.
 */
export function ResponsiveDrawer({
  open,
  onClose,
  title,
  children,
  side = 'left',
  widthClass = 'w-[min(20rem,88vw)]',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'left' | 'right';
  widthClass?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    (focusables()[0] ?? panel)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        className="animate-fade-in absolute inset-0 bg-overlay"
        onClick={onClose}
        role="presentation"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-slide-in relative flex h-full flex-col border-line bg-surface shadow-float outline-none ${widthClass} ${side === 'left' ? 'border-r' : 'ml-auto border-l'}`}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-line px-4">
          <p className="font-display text-card font-semibold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="grid size-11 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
