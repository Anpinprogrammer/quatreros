import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

/** Controles base (DESIGN.md): objetivos táctiles ≥ 44 px, foco visible, mensajes en español. */

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-chimichurri text-white hover:bg-chimichurri-strong disabled:bg-line disabled:text-ink-muted',
  secondary: 'bg-panel text-ink ring-1 ring-line hover:ring-chimichurri disabled:text-ink-muted',
  danger: 'bg-panel text-alerta ring-1 ring-alerta/40 hover:bg-alerta hover:text-white',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-control px-4 font-semibold disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function TextField({
  label,
  error,
  hint,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
        className={`min-h-11 rounded-control border bg-panel px-3 text-base ${error ? 'border-alerta' : 'border-line'} ${className}`}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-alerta">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckboxGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  options: { value: T; label: string; detail?: string }[];
  value: T[];
  onChange: (next: T[]) => void;
  error?: string | undefined;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 font-semibold">{legend}</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 items-center gap-2 rounded-control px-2 hover:bg-surface"
          >
            <input
              type="checkbox"
              className="size-5 accent-chimichurri"
              checked={value.includes(o.value)}
              onChange={(e) => {
                onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value));
              }}
            />
            <span>
              {o.label}
              {o.detail ? <span className="block text-sm text-ink-muted">{o.detail}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-alerta">{error}</p> : null}
    </fieldset>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  const styles =
    tone === 'error' ? 'bg-alerta/10 text-alerta' : 'bg-chimichurri-soft text-chimichurri-strong';
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-control px-3 py-2 ${styles}`}>
      {children}
    </p>
  );
}
