import type { AssistantStreamEvent, MeResponse } from '@quatreros/contracts';
import { ArrowLeft, Send, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { hasPermission } from '../../lib/session';
import { newIdempotencyKey } from '../../services/client';
import {
  streamAssistant,
  useAssistantStatus,
  useCancelProposal,
  useConfirmProposal,
  useCreateTicket,
  useSendMessage,
} from '../../services/assistant';
import { AIActionConfirmation } from '../ui/AIActionConfirmation';
import { AssistantMessage } from './AssistantMessage';
import { Alert } from '../ui/form';

const PANEL_ID = 'quatreros-ai-panel';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface PendingProposal {
  proposalId: string;
  summary: Record<string, unknown>;
  expiresAt: string;
}

function textValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function summaryValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => summaryValue(item)).join(', ');
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  return '—';
}

const SUGGESTIONS = [
  '¿Cuánto chorizo hay en Bodega principal?',
  '¿Qué lotes vencen esta semana?',
  '¿Qué cartera está vencida hoy?',
  '¿Qué pedidos están pendientes de despacho?',
];

/** Asistente Quatreros AI integrado al backend (DEC-106). */
export function AssistantWidget({
  me,
  onOpenChange,
}: {
  me: MeResponse;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    try {
      return window.matchMedia('(max-width: 1023px)').matches;
    } catch {
      return false;
    }
  });
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<PendingProposal | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  const status = useAssistantStatus();
  const createTicket = useCreateTicket();
  const sendMessage = useSendMessage();
  const confirmProposal = useConfirmProposal();
  const cancelProposal = useCancelProposal();
  const canUse = hasPermission(me, 'ia.query');
  const enabled = canUse && status.data?.enabled === true;

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

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
    requestAnimationFrame(() => textRef.current?.focus());

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

  useEffect(() => {
    if (!ticketId) return;
    const onEvent = (event: AssistantStreamEvent) => {
      if (event.type === 'message.delta') {
        const delta = textValue(event.data.text);
        if (!delta) return;
        setMessages((current) => {
          const last = current.at(-1);
          if (last?.role === 'assistant') {
            return [...current.slice(0, -1), { role: 'assistant', text: last.text + delta }];
          }
          return [...current, { role: 'assistant', text: delta }];
        });
      }
      if (event.type === 'proposal.created') {
        setProposal({
          proposalId: textValue(event.data.proposalId),
          summary: (event.data.summary as Record<string, unknown> | undefined) ?? {},
          expiresAt: textValue(event.data.expiresAt),
        });
      }
      if (event.type === 'message.completed') {
        setBusy(false);
      }
      if (event.type === 'error') {
        setBusy(false);
        setError(textValue(event.data.message, 'El asistente no pudo responder.'));
      }
    };
    return streamAssistant(ticketId, onEvent, () => {
      // EventSource se reconecta solo; el estado se mantiene.
    });
  }, [ticketId]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    setError(null);
    setBusy(true);
    setMessages((current) => [...current, { role: 'user', text: value }]);
    try {
      let id = ticketId;
      if (!id) {
        const created = await createTicket.mutateAsync({
          input: { requestText: value },
          idempotencyKey: newIdempotencyKey(),
        });
        id = created.data.id;
        setTicketId(id);
      }
      await sendMessage.mutateAsync({
        ticketId: id,
        text: value,
        idempotencyKey: newIdempotencyKey(),
      });
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'No fue posible enviar el mensaje.');
    }
  };

  const confirm = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      const result = await confirmProposal.mutateAsync(proposal.proposalId);
      setProposal(null);
      setMessages((current) => [...current, { role: 'assistant', text: result.data.summary }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible confirmar la propuesta.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!proposal) return;
    try {
      await cancelProposal.mutateAsync(proposal.proposalId);
      setProposal(null);
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: 'Propuesta cancelada. No se guardó nada.' },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cancelar la propuesta.');
    }
  };

  const close = () => {
    setOpen(false);
  };

  if (!enabled) return null;

  const summaryRows = proposal
    ? Object.entries(proposal.summary)
        .filter(([key, value]) => key !== 'text' && value !== null && value !== undefined)
        .slice(0, 5)
        .map(([key, value]) => ({
          label: key,
          value: summaryValue(value),
        }))
    : [];

  return (
    <>
      <div className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 sm:right-6 sm:bottom-6">
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
          title="Asistente Quatreros"
          className={`group relative grid size-16 place-items-center rounded-full border border-brand bg-[#191B20] shadow-[0_12px_28px_-12px_rgba(25,27,32,0.55)] transition-[transform,opacity,border-color,box-shadow] duration-200 hover:border-brand-hover hover:shadow-[0_18px_36px_-14px_rgba(25,27,32,0.65)] active:scale-95 motion-safe:hover:-translate-y-1 focus-visible:outline-offset-4 lg:size-[72px] dark:border-brand dark:bg-[#272A30] dark:shadow-[0_16px_36px_-14px_rgba(0,0,0,0.7)] ${
            open ? 'pointer-events-none scale-90 opacity-0' : 'opacity-100'
          }`}
        >
          <img
            src="/cuatreros-bot-full.webp"
            alt=""
            width={360}
            height={360}
            className="size-14 object-contain lg:size-16"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-full mr-3 hidden rounded-xl border border-line bg-surface px-3 py-1.5 text-caption font-semibold whitespace-nowrap text-ink opacity-0 shadow-float transition-opacity group-hover:opacity-100 lg:block"
          >
            Asistente Quatreros
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
          className="animate-panel-in fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden border-line bg-surface shadow-float outline-none lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[20vw] lg:border-l"
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
                <span aria-hidden className="size-1.5 rounded-full bg-success" />
                En línea
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

          <div className="scroll-thin flex-1 overflow-y-auto p-3" aria-live="polite">
            {messages.length === 0 ? (
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
                  Pregúntame por existencias, lotes, cartera o pedidos. También puedo preparar materias primas
                  y recetas.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setText(suggestion);
                        textRef.current?.focus();
                      }}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold text-ink-2 hover:border-brand/50 hover:text-ink"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {messages.map((message, index) => (
                  <li
                    key={`${message.role}-${index}`}
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-caption leading-5 ${
                      message.role === 'user'
                        ? 'ml-auto bg-brand text-white'
                        : 'border border-line bg-surface-2 text-ink'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <AssistantMessage text={message.text} />
                    ) : (
                      <span className="whitespace-pre-wrap">{message.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {proposal ? (
              <div className="mt-3">
                <AIActionConfirmation
                  rows={summaryRows}
                  consequence={`Expira ${new Date(proposal.expiresAt).toLocaleTimeString('es-CO')}. Nada se guarda sin tu confirmación.`}
                  busy={busy}
                  onConfirm={() => {
                    void confirm();
                  }}
                  onCancel={() => {
                    void cancel();
                  }}
                />
              </div>
            ) : null}

            {error ? (
              <div className="mt-3">
                <Alert tone="error">{error}</Alert>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <label htmlFor="assistant-message" className="sr-only">
              Mensaje para Quatreros AI
            </label>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <input
                ref={textRef}
                id="assistant-message"
                type="text"
                value={text}
                disabled={busy}
                placeholder={busy ? 'Pensando…' : 'Escribe tu pregunta'}
                onChange={(event) => {
                  setText(event.target.value);
                }}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-2.5 text-caption text-ink placeholder:text-ink-3 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={busy || text.trim().length === 0}
                aria-label="Enviar mensaje"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3"
              >
                <Send aria-hidden className="size-4" />
              </button>
            </form>
            <p className="mt-2 flex items-center gap-1 text-[10px] leading-4 text-ink-3">
              <ShieldCheck aria-hidden className="size-3" />
              Consultas y preparación de materias primas/recetas. Nada se guarda sin confirmar.
            </p>
            <Link
              to="/erp/ia/asistente"
              onClick={close}
              className="mt-1 inline-flex text-[10px] font-semibold text-brand-ink hover:text-ink"
            >
              Ver tickets y consumo
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
