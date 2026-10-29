import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useId, useState } from 'react';

/**
 * Controles base (DESIGN.md): objetivos táctiles ≥ 44 px, foco visible, mensajes en español.
 * Los bordes de controles usan `control` (≥ 3:1, WCAG 1.4.11); `line` queda para separadores.
 */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-chimichurri text-white hover:bg-chimichurri-strong disabled:bg-line disabled:text-ink-muted',
  secondary: 'bg-panel text-ink ring-1 ring-control hover:ring-chimichurri disabled:text-ink-muted',
  danger: 'bg-panel text-alerta ring-1 ring-alerta hover:bg-alerta hover:text-white',
  quiet: 'text-ink-muted underline underline-offset-4 hover:text-ink',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-control px-4 font-semibold disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  hint?: string;
  /** Contenido junto al campo (p. ej. "Mostrar" o "Generar"). */
  addon?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

export function TextField({ label, error, hint, className = '', addon, ...props }: TextFieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
          className={`min-h-11 min-w-0 flex-1 rounded-control border bg-panel px-3 text-base ${error ? 'border-alerta' : 'border-control'} ${className}`}
        />
        {addon}
      </div>
      {hint ? (
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

/** Contraseña con botón "Mostrar": reduce errores de digitación en celular. */
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'addon'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      addon={
        <Button
          variant="secondary"
          aria-pressed={visible}
          onClick={() => {
            setVisible((v) => !v);
          }}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </Button>
      }
    />
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
  const id = useId();
  return (
    <fieldset
      className="flex flex-col gap-1"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
    >
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
      {error ? (
        <p id={`${id}-error`} className="text-sm text-alerta">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function Alert({
  tone = 'error',
  children,
  id,
}: {
  tone?: 'error' | 'info';
  children: ReactNode;
  id?: string;
}) {
  const styles =
    tone === 'error' ? 'bg-alerta/10 text-alerta' : 'bg-chimichurri-soft text-chimichurri-strong';
  return (
    <p id={id} role={tone === 'error' ? 'alert' : 'status'} className={`rounded-control px-3 py-2 ${styles}`}>
      {children}
    </p>
  );
}
