import { Link } from 'react-router';

/**
 * Marca provisional (el isotipo oficial sigue pendiente, Anexo B del sistema de diseño).
 * El anillo evoca el aro del isotipo y los cuatro puntos, a Los 4 Treros.
 */
export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box =
    size === 'lg'
      ? 'size-12 rounded-[16px]'
      : size === 'sm'
        ? 'size-8 rounded-[10px]'
        : 'size-10 rounded-[12px]';
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center bg-brand text-white shadow-brand-sm ${box}`}
    >
      <svg viewBox="0 0 32 32" className={size === 'lg' ? 'size-8' : 'size-6'} fill="none">
        <circle cx="16" cy="16" r="10.25" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="16" cy="16" r="3.4" fill="currentColor" />
        <circle cx="16" cy="3.4" r="1.7" fill="currentColor" />
        <circle cx="28.6" cy="16" r="1.7" fill="currentColor" />
        <circle cx="16" cy="28.6" r="1.7" fill="currentColor" />
        <circle cx="3.4" cy="16" r="1.7" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Brand({
  to = '/',
  area,
  compact = false,
  inverse = false,
}: {
  to?: string;
  area?: string;
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-2.5 rounded-xl font-bold whitespace-nowrap"
      aria-label={compact ? 'Quatreros' : undefined}
    >
      <BrandMark size={compact ? 'sm' : 'md'} />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display text-card font-extrabold tracking-[-0.03em] ${inverse ? 'text-white' : 'text-ink'}`}
          >
            Quatreros
          </span>
          <span
            className={`mt-1 text-[10px] font-semibold tracking-[0.18em] uppercase ${inverse ? 'text-white/60' : 'text-ink-3'}`}
          >
            {area ?? 'Los 4 Treros'}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
