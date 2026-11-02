import type { MeResponse } from '@quatreros/contracts';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { breadcrumbsFor } from '../../shared/modules';
import { EmptyState } from '../../shared/ui/EmptyState';
import { UserMenu } from '../../shared/ui/UserMenu';
import { CommandPalette } from './CommandPalette';

function Breadcrumbs() {
  const location = useLocation();
  const crumbs = breadcrumbsFor(location.pathname);
  return (
    <nav aria-label="Migas de pan" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-body">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${String(index)}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-ink-3 sm:block" />
              ) : null}
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

/** Alcance de sedes: informa las sedes autorizadas; el backend aplica el filtro. */
function SiteMenu({ me }: { me: MeResponse }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const names = me.sites.map((site) => site.name);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (me.sites.length === 0) return null;
  const label = names.length === 1 ? names[0] : `${String(names.length)} sedes`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Sedes autorizadas: ${label}`}
        title={`Sedes autorizadas: ${names.join(', ')}`}
        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-caption font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      >
        <MapPin aria-hidden className="size-4 shrink-0 text-brand-ink" />
        <span className="hidden max-w-36 truncate xl:inline">{label}</span>
        <ChevronDown aria-hidden className="hidden size-3.5 shrink-0 text-ink-3 xl:block" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Sedes autorizadas"
          className="animate-rise absolute top-full right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-3 shadow-float"
        >
          <p className="text-caption font-semibold text-ink">Sedes autorizadas</p>
          <p className="mt-0.5 text-[11px] text-ink-2">Alcance actual de tus datos.</p>
          <ul className="mt-3 space-y-1.5">
            {me.sites.map((site) => (
              <li key={site.id} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-2.5 py-2">
                <MapPin aria-hidden className="size-3.5 shrink-0 text-brand-ink" />
                <span className="min-w-0 flex-1 truncate text-caption font-medium text-ink">{site.name}</span>
                <span className="shrink-0 text-[10px] text-ink-3">
                  {site.kind === 'warehouse' ? 'Bodega' : 'Punto de venta'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-2 text-[11px] leading-4 text-ink-3">
            La información se limita automáticamente a estas sedes.
          </p>
        </div>
      ) : null}
    </div>
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
        aria-haspopup="dialog"
        title="Notificaciones"
        className="grid size-11 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Bell aria-hidden className="size-5" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="animate-rise absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-float"
        >
          <p className="px-3 py-2 font-display text-card font-semibold text-ink">Notificaciones</p>
          <EmptyState
            compact
            title="Sin notificaciones"
            description="Las alertas operativas aparecerán aquí cuando sus módulos estén activos."
          />
        </div>
      ) : null}
    </div>
  );
}

/** Encabezado global: contraer navegación, contexto, búsqueda, sedes, alertas y sesión. */
export function AppHeader({
  me,
  collapsed,
  onToggleCollapse,
  onOpenNav,
}: {
  me: MeResponse;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNav: () => void;
}) {
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
      <div className="flex h-[72px] items-center gap-2 px-4 md:gap-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="Abrir navegación"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
            title={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
            className="hidden size-10 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:grid"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-5" />
            ) : (
              <PanelLeftClose aria-hidden className="size-5" />
            )}
          </button>
          <div className="hidden min-w-0 lg:block">
            <Breadcrumbs />
          </div>
          <CurrentContext />
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <button
            type="button"
            onClick={() => {
              setPaletteOpen(true);
            }}
            aria-keyshortcuts="Meta+K Control+K"
            className="flex min-h-10 w-full max-w-md items-center gap-2 rounded-xl border border-line bg-surface px-3 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            <Search aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Buscar en Quatreros</span>
            <span className="flex-1 text-left">Buscar…</span>
            <kbd
              aria-hidden
              className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3"
            >
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex flex-1 items-center justify-end gap-1 md:gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPaletteOpen(true);
            }}
            aria-label="Buscar en Quatreros"
            aria-keyshortcuts="Meta+K Control+K"
            className="grid size-11 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <Search aria-hidden className="size-5" />
          </button>
          <SiteMenu me={me} />
          <NotificationsMenu />
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
