import type { MeResponse } from '@quatreros/contracts';
import { ChevronDown, LogOut, MapPin, Moon, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSignOut } from '../auth/session';
import { useTheme } from './theme';

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const menuItemClass =
  'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-body font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2';

/**
 * Avatar y menú de sesión. El nombre y el rol del usuario viven dentro del menú;
 * en POS se puede mostrar la identidad junto al avatar para el cajero.
 */
export function UserMenu({
  me,
  compact = false,
  showName = false,
}: {
  me: MeResponse;
  compact?: boolean;
  showName?: boolean;
}) {
  const labelId = useId();
  const signOut = useSignOut();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitemcheckbox"], [role="menuitem"]')?.focus();
    });
  }, [open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      close(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]') ?? [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        {...(!showName ? { 'aria-labelledby': labelId } : {})}
        title={me.user.fullName}
        className={`flex min-h-11 items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 ${open ? 'bg-surface-2' : ''}`}
      >
        {!showName ? (
          <span id={labelId} className="sr-only">
            Abrir menú de usuario de {me.user.fullName} ({me.roles.map((role) => role.name).join(', ')})
          </span>
        ) : null}
        {!compact && showName ? (
          <span className="text-right">
            <span className="block max-w-32 truncate text-caption font-semibold text-ink">
              {me.user.fullName}
            </span>
            <span className="block max-w-32 truncate text-[11px] text-ink-2">
              {me.roles.map((role) => role.name).join(', ')}
            </span>
          </span>
        ) : null}
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 text-ink"
        >
          <UserRound className="size-4" />
        </span>
        <ChevronDown
          aria-hidden
          className={`size-3.5 text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="animate-rise absolute top-full right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-float">
          <div className="rounded-xl bg-surface-2/60 p-3">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-caption font-bold text-ink"
              >
                {initials(me.user.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-ink">{me.user.fullName}</p>
                <p className="truncate text-caption text-ink-2">{me.user.email}</p>
                <p className="mt-1 truncate text-caption text-ink-2">
                  {me.roles.map((role) => role.name).join(', ')}
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-line pt-2.5">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
                Sedes autorizadas
              </p>
              {me.sites.length === 0 ? (
                <p className="mt-1 text-caption text-ink-2">Sin sede asignada</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {me.sites.map((site) => (
                    <li key={site.id} className="flex items-center gap-2 text-caption text-ink-2">
                      <MapPin aria-hidden className="size-3.5 shrink-0 text-brand-ink" />
                      <span className="truncate text-ink">{site.name}</span>
                      <span className="ml-auto shrink-0 text-ink-3">
                        {site.kind === 'warehouse' ? 'Bodega' : 'Punto de venta'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] leading-4 text-ink-3">
                El servidor limita la información a estas sedes.
              </p>
            </div>
          </div>

          <div
            ref={menuRef}
            role="menu"
            aria-label="Menú de usuario"
            onKeyDown={onMenuKeyDown}
            className="mt-2"
          >
            <div role="separator" className="mb-2 h-px bg-line" />

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={theme === 'dark'}
              onClick={toggle}
              className={menuItemClass}
            >
              <Moon aria-hidden className="size-4 shrink-0 text-ink-2" />
              <span>Modo oscuro</span>
              <span
                aria-hidden
                className={`ml-auto flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors ${
                  theme === 'dark' ? 'border-brand bg-brand' : 'border-line-strong bg-surface-3'
                }`}
              >
                <span
                  className={`block size-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                void signOut();
              }}
              className={`${menuItemClass} text-danger hover:bg-danger/10 focus-visible:bg-danger/10`}
            >
              <LogOut aria-hidden className="size-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
