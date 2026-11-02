import { Eye, EyeOff } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from 'react';
import { useId, useState } from 'react';

/**
 * Controles base del UI Kit "Los Quatreros" (docs/05-design/sistema-de-diseno.md §3).
 * Ajustes AA (Anexo A): etiqueta del botón primario en texto grande; borde de campos `control`.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  // A. Primary Action: Ember, texto blanco, ≥ 52 px. La etiqueta es texto grande en negrita (Anexo A).
  primary:
    'min-h-[52px] px-5 text-action font-bold bg-brand text-white shadow-brand hover:bg-brand-hover active:translate-y-px disabled:bg-surface-3 disabled:text-ink-3 disabled:shadow-none',
  // A. Secondary Action: superficie elevada, borde visible, texto principal.
  secondary:
    'min-h-11 px-4 font-semibold bg-surface text-ink border border-line-strong hover:border-ink-3 hover:bg-surface-2 disabled:text-ink-3 disabled:hover:border-line-strong disabled:hover:bg-surface',
  // A. Ghost / Cancel: sin borde, texto secundario, hover suave.
  ghost: 'min-h-11 px-4 font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink',
  // Acción destructiva con la semántica Danger.
  danger: 'min-h-11 px-4 font-semibold bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-[background-color,border-color,color,box-shadow,transform] duration-200 disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  hint?: string;
  /** Contenido junto al campo (p. ej. "Generar"). */
  addon?: ReactNode;
  /** Icono decorativo al inicio del campo. */
  leadingIcon?: ReactNode;
  /** Acción dentro del campo, alineada a la derecha (p. ej. mostrar contraseña). */
  trailingSlot?: ReactNode;
  /** `lg` eleva el campo a 52 px para formularios de acceso. */
  inputSize?: 'md' | 'lg';
  /** Marca el campo como inválido aunque el mensaje se muestre fuera de él. */
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/** D. Input: alto ≥ 48 px; 16 px en celular para que iOS no amplíe al enfocar (Anexo A). */
export function TextField({
  label,
  error,
  hint,
  className = '',
  addon,
  leadingIcon,
  trailingSlot,
  inputSize = 'md',
  invalid = false,
  ...props
}: TextFieldProps) {
  const id = useId();
  const invalidField = Boolean(error) || invalid;
  const { 'aria-describedby': externalDescribedBy, ...inputProps } = props;
  const describedBy = [externalDescribedBy, error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-semibold text-ink">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="group relative min-w-0 flex-1">
          {leadingIcon ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-3 transition-colors group-focus-within:text-brand-ink"
            >
              {leadingIcon}
            </span>
          ) : null}
          <input
            id={id}
            aria-invalid={invalidField ? true : undefined}
            aria-describedby={describedBy || undefined}
            {...inputProps}
            className={`w-full rounded-xl border bg-surface text-base text-ink transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-ink-3 hover:border-ink-3 focus:border-brand focus:ring-4 focus:outline-none sm:text-body ${inputSize === 'lg' ? 'min-h-[52px]' : 'min-h-12'} ${leadingIcon ? 'pl-11' : 'pl-3'} ${trailingSlot ? 'pr-11' : 'pr-3'} ${invalidField ? 'border-danger focus:ring-brand/10' : 'border-control focus:ring-brand/10'} ${className}`}
          />
          {trailingSlot ? (
            <span className="absolute inset-y-0 right-1.5 flex items-center">{trailingSlot}</span>
          ) : null}
        </div>
        {addon}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-caption font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | undefined;
  hint?: string;
  options: { value: string; label: string }[];
  ref?: Ref<HTMLSelectElement>;
};

/** Selección simple con los mismos tokens, borde y altura que TextField (Anexo A). */
export function SelectField({ label, error, hint, options, className = '', ...props }: SelectFieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
        className={`min-h-12 w-full min-w-0 rounded-xl border bg-surface px-3 text-base text-ink transition-colors duration-200 hover:border-ink-3 focus:border-brand sm:text-body ${error ? 'border-danger' : 'border-control'} ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-caption font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Casilla única (p. ej. "controla vencimiento") con el mismo foco Ember del kit. */
export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
  error,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | undefined;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-surface px-3 transition-colors duration-200 hover:border-control ${checked ? 'border-brand/60' : 'border-line-strong'}`}
      >
        <input
          id={id}
          type="checkbox"
          className="size-5 accent-brand"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
        />
        <span>
          {label}
          {hint ? <span className="block text-caption text-ink-2">{hint}</span> : null}
        </span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="text-caption font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Contraseña con el control mostrar/ocultar integrado dentro del campo. */
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'addon'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailingSlot={
        <button
          type="button"
          aria-label={visible ? 'Ocultar' : 'Mostrar'}
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => {
            setVisible((v) => !v);
          }}
          className="grid size-10 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-offset-1"
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
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
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors duration-200 ${checked ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface hover:border-control'}`}
            >
              <input
                type="checkbox"
                className="size-5 accent-brand"
                checked={checked}
                onChange={(e) => {
                  onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value));
                }}
              />
              <span>
                {o.label}
                {o.detail ? <span className="block text-caption text-ink-2">{o.detail}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-caption font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

type AlertTone = 'error' | 'success' | 'info';

const alertStyles: Record<AlertTone, string> = {
  error: 'bg-danger/10 text-danger border-danger/25',
  success: 'bg-success/10 text-success border-success/25',
  info: 'bg-info/10 text-info border-info/25',
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
