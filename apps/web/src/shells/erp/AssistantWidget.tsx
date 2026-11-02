import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  CreditCard,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../shared/ui/Badge';

const PANEL_ID = 'quatreros-ai-panel';

/**
 * Burbuja y panel de Quatreros AI (sistema de diseño, Parte 2 §5).
 * Es la vista previa visual del asistente: el agente se integra en la entrega 8, así que
 * el compositor está deshabilitado y no se simulan conversaciones ni respuestas.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    try {
      return window.matchMedia('(max-width: 1023px)').matches;
    } catch {
      return false;
    }
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    try {
      const media = window.matchMedia('(max-width: 1023px)');
      const update = () => {
        setIsMobile(media.matches);
      };
      media.addEventListener('change', update);
      return () => {
        media.removeEventListener('change', update);
      };
    } catch {
      // jsdom y entornos sin matchMedia: se mantiene el panel de escritorio.
      return;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        wasOpen.current = false;
        requestAnimationFrame(() => bubbleRef.current?.focus());
      }
      return;
    }

    wasOpen.current = true;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !isMobile) return;
      const panel = panelRef.current;
      const focusables = Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
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
    const previousOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobile]);

  const close = () => {
    setOpen(false);
  };

  return (
    <>
      <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
        <button
          ref={bubbleRef}
          type="button"
          onClick={() => {
            setOpen((current) => !current);
          }}
          aria-label="Abrir Quatreros AI"
          aria-expanded={open}
          aria-controls={open ? PANEL_ID : undefined}
          aria-hidden={open || undefined}
          tabIndex={open ? -1 : 0}
          title="Hablar con Quatreros AI"
          className={`group relative grid size-16 place-items-center rounded-full border border-line bg-brand-soft shadow-float transition-[transform,opacity,border-color] duration-200 hover:border-brand/40 motion-safe:hover:-translate-y-0.5 focus-visible:outline-offset-4 ${
            open ? 'pointer-events-none scale-90 opacity-0' : 'opacity-100'
          }`}
        >
          <img
            src="/cuatreros-bot-avatar.webp"
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-full object-cover"
          />
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-surface bg-brand text-white"
          >
            <Sparkles className="size-2.5" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute right-full mr-3 hidden rounded-xl border border-line bg-surface px-3 py-1.5 text-caption font-semibold whitespace-nowrap text-ink opacity-0 shadow-float transition-opacity group-hover:opacity-100 lg:block"
          >
            Hablar con Quatreros AI
          </span>
        </button>
      </div>

      {open ? (
        <div
          ref={panelRef}
          id={PANEL_ID}
          role="dialog"
          aria-modal={isMobile || undefined}
          aria-labelledby="quatreros-ai-title"
          tabIndex={-1}
          className="animate-panel-in fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden border-line bg-surface shadow-float outline-none lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[clamp(13rem,15vw,24rem)] lg:border-l"
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
            <button
              type="button"
              onClick={close}
              aria-label="Volver"
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl pr-1 text-body font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
            >
              <ArrowLeft aria-hidden className="size-5" />
              Volver
            </button>
            <img
              src="/cuatreros-bot-avatar.webp"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-full bg-brand-soft object-cover"
            />
            <div className="min-w-0 flex-1">
              <h2 id="quatreros-ai-title" className="truncate font-display text-body font-bold text-ink">
                Quatreros AI
              </h2>
              <p className="flex items-center gap-1 text-[11px] text-ink-2">
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                En preparación
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar Quatreros AI"
              className="hidden size-9 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:grid"
            >
              <X aria-hidden className="size-4" />
            </button>
          </header>

          <div className="scroll-thin flex-1 overflow-y-auto p-3">
            <div className="rounded-2xl border border-line bg-surface-2/60 px-3 py-4 text-center">
              <img
                src="/cuatreros-bot-full.webp"
                alt=""
                width={112}
                height={112}
                className="mx-auto size-28 object-contain"
              />
              <h3 className="mt-2 font-display text-[15px] leading-5 font-bold text-ink">
                Hola, soy Quatreros AI
              </h3>
              <p className="mt-1 text-caption leading-5 text-ink-2">
                Estoy en preparación. Aún no estoy conectado a los datos de la empresa.
              </p>
              <div className="mt-3 flex justify-center">
                <Badge tone="warning">Vista previa</Badge>
              </div>
            </div>

            <section aria-labelledby="asistente-podra" className="mt-4">
              <p
                id="asistente-podra"
                className="text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase"
              >
                Cuando esté activo
              </p>
              <ul className="mt-2 space-y-2">
                {[
                  { icon: <Boxes className="size-3.5" />, text: 'Consultar existencias y lotes' },
                  { icon: <CreditCard className="size-3.5" />, text: 'Revisar cartera y cupos' },
                  {
                    icon: <ClipboardList className="size-3.5" />,
                    text: 'Preparar compras para confirmar',
                  },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"
                    >
                      {item.icon}
                    </span>
                    <span className="text-caption leading-5 text-ink-2">{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="flex items-center gap-1.5 text-caption font-semibold text-ink">
                <ShieldCheck aria-hidden className="size-4 shrink-0 text-success" />
                Con confirmación humana
              </p>
              <p className="mt-1 text-[11px] leading-4 text-ink-2">
                Ninguna escritura se ejecutará sin tu confirmación y la autorización del servidor.
              </p>
            </div>

            <Link
              to="/erp/seccion/ia"
              onClick={close}
              className="mt-3 inline-flex min-h-10 items-center gap-1 text-caption font-semibold text-brand-ink hover:text-ink"
            >
              Ver estado del asistente
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>

          <div className="shrink-0 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <label htmlFor="assistant-message" className="sr-only">
              Mensaje para Quatreros AI
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="assistant-message"
                type="text"
                disabled
                placeholder="Próximamente"
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-2.5 text-caption text-ink placeholder:text-ink-3 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled
                aria-label="Enviar mensaje"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3"
              >
                <Send aria-hidden className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-ink-3">
              Sin respuestas simuladas: el chat se conectará cuando el agente esté desplegado.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
