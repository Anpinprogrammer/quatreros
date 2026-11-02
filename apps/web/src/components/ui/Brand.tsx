import { Link } from 'react-router';

const markSize = { md: 44, lg: 56 } as const;

/**
 * Marca oficial "Los 4 Treros" (logo entregado por el responsable, Anexo B del sistema de diseño).
 * El archivo optimizado conserva el aro naranja y el personaje; el nombre accesible lo da el texto.
 */
export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const pixels = markSize[size];
  return (
    <img
      src="/logo-mark.webp"
      alt=""
      width={pixels}
      height={pixels}
      decoding="async"
      className="shrink-0 object-contain"
    />
  );
}

export function Brand({
  to = '/',
  area,
  compact = false,
  inverse = false,
  markSize = 'md',
}: {
  to?: string;
  area?: string;
  compact?: boolean;
  inverse?: boolean;
  markSize?: 'md' | 'lg';
}) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-2.5 rounded-xl font-bold whitespace-nowrap"
      aria-label={compact ? 'Quatreros' : undefined}
    >
      <BrandMark size={markSize} />
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
