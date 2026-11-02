import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; tone: ToastTone; text: string };

const ToastContext = createContext<{ show: (text: string, tone?: ToastTone) => void } | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/25 bg-surface text-ink',
  error: 'border-danger/25 bg-surface text-ink',
  info: 'border-info/25 bg-surface text-ink',
};

const toneIcon: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 aria-hidden className="size-5 text-success" />,
  error: <AlertTriangle aria-hidden className="size-5 text-danger" />,
  info: <Info aria-hidden className="size-5 text-info" />,
};

/** Confirmaciones breves de acciones completadas. Los errores siguen junto al formulario. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (text: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { id, tone, text }]);
      timers.current.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, 6500),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => {
        clearTimeout(timer);
      });
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-end gap-2 sm:left-auto sm:w-full sm:max-w-sm"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={`animate-toast-in pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-float ${toneStyles[item.tone]}`}
          >
            <span className="mt-0.5 shrink-0">{toneIcon[item.tone]}</span>
            <p className="min-w-0 flex-1 text-body font-medium">{item.text}</p>
            <button
              type="button"
              onClick={() => {
                dismiss(item.id);
              }}
              aria-label="Cerrar aviso"
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
}
