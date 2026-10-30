import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useId, useState } from 'react';

/**
 * Controles base del UI Kit "Los Quatreros" (docs/05-design/sistema-de-diseno.md §3).
 * Ajustes AA (Anexo A): etiqueta del botón primario en texto grande; borde de campos `control`.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  // A. Primary Action: Ember, texto blanco, rounded-xl, brillo de brasa, ≥ 52 px.
  primary:
    'min-h-[52px] px-5 text-action font-bold bg-ember text-chalk shadow-lg shadow-orange-950/50 hover:bg-ember-hover disabled:bg-grill disabled:text-ash disabled:shadow-none',
  // A. Secondary Action: #27272A, borde #3F3F46, texto blanco.
  secondary:
    'min-h-11 px-4 font-semibold bg-grill text-chalk border border-grill-strong hover:border-ash disabled:text-ash disabled:hover:border-grill-strong',
  // A. Ghost / Cancel: sin borde, texto Ash, hover a #27272A.
  ghost: 'min-h-11 px-4 font-semibold text-ash hover:bg-grill hover:text-chalk',
  // Acción destructiva con la semántica Danger (patrón de badges §3.C).
  danger:
    'min-h-11 px-4 font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-colors duration-200 disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
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

/** D. Input: alto ≥ 48 px; 16 px en celular para que iOS no amplíe al enfocar (Anexo A). */
export function TextField({ label, error, hint, className = '', addon, ...props }: TextFieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-semibold text-chalk">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
          className={`min-h-12 min-w-0 flex-1 rounded-xl border bg-char px-3 text-base text-chalk placeholder:text-ash sm:text-body ${error ? 'border-danger' : 'border-control'} ${className}`}
        />
        {addon}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-ash">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-caption font-semibold text-red-400">
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
          className="min-h-12"
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
      className="flex flex-col gap-1.5"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend className="mb-1.5 text-body font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors duration-200 ${checked ? 'border-ember bg-ember/10' : 'border-grill bg-char hover:border-control'}`}
            >
              <input
                type="checkbox"
                className="size-5 accent-ember"
                checked={checked}
                onChange={(e) => {
                  onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value));
                }}
              />
              <span>
                {o.label}
                {o.detail ? <span className="block text-caption text-ash">{o.detail}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-caption font-semibold text-red-400">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

type AlertTone = 'error' | 'success' | 'info';

const alertStyles: Record<AlertTone, string> = {
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function Alert({
  tone = 'error',
  children,
  id,
}: {
  tone?: AlertTone;
  children: ReactNode;
  id?: string;
}) {
  return (
    <p
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-body ${alertStyles[tone]}`}
    >
      {children}
    </p>
  );
}
