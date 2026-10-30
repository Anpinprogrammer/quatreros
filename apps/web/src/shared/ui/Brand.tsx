import { Link } from 'react-router';

/**
 * Logotipo provisional de texto (Anexo B del sistema de diseño: el isotipo oficial está pendiente).
 * El anillo Ember evoca el anillo exterior del isotipo.
 */
export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-12 border-4' : 'size-8 border-[3px]';
  const dot = size === 'lg' ? 'size-4' : 'size-2.5';
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full border-ember ${box}`}>
      <span className={`rounded-full bg-terracotta ${dot}`} />
    </span>
  );
}

export function Brand({ to = '/', area }: { to?: string; area?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-2.5 rounded-xl font-bold whitespace-nowrap"
    >
      <BrandMark />
      <span className="text-title tracking-tight text-chalk">Quatreros</span>
      {area ? (
        <span className="text-caption font-semibold tracking-wider text-ash uppercase">{area}</span>
      ) : null}
    </Link>
  );
}
