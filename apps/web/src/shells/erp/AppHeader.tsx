import type { MeResponse } from '@quatreros/contracts';
import { Bell, ChevronRight, Home, MapPin, Menu, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { breadcrumbsFor } from '../../shared/modules';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ThemeToggle } from '../../shared/ui/theme';
import { UserMenu } from '../../shared/ui/UserMenu';
import { CommandPalette } from './CommandPalette';

function Breadcrumbs() {
  const location = useLocation();
  const crumbs = breadcrumbsFor(location.pathname);
  return (
    <nav aria-label="Migas de pan" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-body">
        <li className="hidden sm:block">
          <Link
            to="/erp"
            aria-label="Inicio"
            className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Home aria-hidden className="size-4" />
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${String(index)}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 || crumbs.length > 1 ? (
                <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-ink-3 sm:block" />
              ) : (
                <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
              )}
              {crumb.to && !last ? (
                <Link
                  to={crumb.to}
                  className="hidden max-w-40 truncate rounded px-1 text-ink-2 transition-colors hover:text-ink sm:block"
                >
                  {crumb.label}
                </Link>
              ) : null}
              {!crumb.to || last ? (
                <span
                  className={`max-w-56 truncate font-semibold text-ink ${last ? '' : 'hidden sm:block'}`}
                  aria-current={last ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CurrentContext() {
  const location = useLocation();
  const current = breadcrumbsFor(location.pathname).at(-1);
  return (
    <span className="hidden max-w-48 truncate font-display text-body font-semibold text-ink sm:block lg:hidden">
      {current?.label}
    </span>
  );
}

function SiteIndicator({ me }: { me: MeResponse }) {
  if (me.sites.length === 0) return null;
  const names = me.sites.map((site) => site.name);
  const label = names.length === 1 ? names[0] : `${names[0]} +${String(names.length - 1)}`;
  return (
    <span
      title={`Sedes autorizadas: ${names.join(', ')}`}
      aria-label={`Sedes autorizadas: ${names.join(', ')}`}
      className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-caption font-semibold whitespace-nowrap text-ink-2 xl:inline-flex"
    >
      <MapPin aria-hidden className="size-3.5 text-brand-ink" />
      {label}
    </span>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-label="Notificaciones"
        aria-expanded={open}
        title="Notificaciones"
        className="grid size-11 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Bell aria-hidden className="size-5" />
      </button>
      {open ? (
        <div className="animate-rise absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-float">
          <p className="px-3 py-2 font-display text-card font-semibold text-ink">Notificaciones</p>
          <EmptyState
            compact
            title="Sin notificaciones"
            description="Las alertas de FEFO, caja y cartera aparecerán aquí cuando sus módulos estén activos."
          />
        </div>
      ) : null}
    </div>
  );
}

/** Encabezado global: contexto, búsqueda, sede, notificaciones, tema y sesión. */
export function AppHeader({ me, onOpenNav }: { me: MeResponse; onOpenNav: () => void }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-header backdrop-blur-xl">
      <div className="flex h-[72px] items-center gap-2 px-4 md:gap-4 md:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Abrir navegación"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
        >
          <Menu aria-hidden className="size-5" />
        </button>

        <div className="hidden min-w-0 lg:block">
          <Breadcrumbs />
        </div>
        <CurrentContext />

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => {
              setPaletteOpen(true);
            }}
            className="flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink md:min-w-56"
          >
            <Search aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Buscar en Quatreros</span>
            <span className="hidden flex-1 text-left md:inline">Buscar…</span>
            <kbd
              aria-hidden
              className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3 md:inline"
            >
              ⌘K
            </kbd>
          </button>

          <SiteIndicator me={me} />
          <NotificationsMenu />
          <ThemeToggle />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <UserMenu me={me} />
        </div>
      </div>

      <CommandPalette
        me={me}
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false);
        }}
      />
    </header>
  );
}
