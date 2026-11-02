import { Search } from 'lucide-react';
import { useId, type InputHTMLAttributes, type Ref } from 'react';

/** Campo de búsqueda con icono, altura táctil y etiqueta siempre asociada. */
export function SearchInput({
  label,
  className = '',
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; ref?: Ref<HTMLInputElement> }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3"
          strokeWidth={2}
        />
        <input
          ref={ref}
          id={id}
          type="search"
          {...props}
          className={`min-h-12 w-full rounded-xl border border-control bg-surface pr-3 pl-10 text-base text-ink transition-colors duration-200 placeholder:text-ink-3 hover:border-ink-3 focus:border-brand sm:text-body ${className}`}
        />
      </div>
    </div>
  );
}
