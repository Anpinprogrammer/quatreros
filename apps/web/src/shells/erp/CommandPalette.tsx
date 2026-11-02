import type { MeResponse } from '@quatreros/contracts';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { isUsable, visibleSections, type ModuleIconName } from '../../shared/modules';
import { ModuleIcon } from '../../shared/ui/ModuleIcon';

type Item = {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: ModuleIconName;
  kind: 'Sección' | 'Módulo';
};

/**
 * Búsqueda de navegación (⌘K / Ctrl+K). No consulta registros: lleva a las pantallas que
 * existen y a las que el usuario puede abrir según sus permisos.
 */
export function CommandPalette({
  me,
  open,
  onClose,
}: {
  me: MeResponse;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  const items = useMemo<Item[]>(() => {
    const sections = visibleSections(me);
    return [
      ...sections.map((section) => ({
        id: `section-${section.id}`,
        label: section.name,
        description: section.description,
        to: section.path,
        icon: section.icon,
        kind: 'Sección' as const,
      })),
      ...sections.flatMap((section) =>
        section.modules
          .filter((module) => isUsable(module, me) && module.path)
          .map((module) => ({
            id: `module-${module.id}`,
            label: module.name,
            description: module.description,
            to: module.path ?? section.path,
            icon: module.icon,
            kind: 'Módulo' as const,
          })),
      ),
    ];
  }, [me]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.label} ${item.description} ${item.kind}`.toLowerCase().includes(term),
    );
  }, [items, query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = () => {
    setQuery('');
    setActive(0);
    onClose();
  };

  const go = (item: Item | undefined) => {
    if (!item) return;
    close();
    void navigate(item.to);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Buscar en Quatreros"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-overlay"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search aria-hidden className="size-4 shrink-0 text-ink-3" />
        <label htmlFor="command-search" className="sr-only">
          Buscar módulos y secciones
        </label>
        <input
          ref={inputRef}
          id="command-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current) => Math.min(current + 1, filtered.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              go(filtered[active]);
            }
          }}
          placeholder="Buscar una sección o un módulo…"
          className="min-h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar búsqueda"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-8 text-center text-body text-ink-2">
          No hay secciones ni módulos que coincidan con “{query.trim()}”.
        </p>
      ) : (
        <ul className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          {filtered.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  go(item);
                }}
                onMouseEnter={() => {
                  setActive(index);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  index === active ? 'bg-brand-soft' : 'hover:bg-surface-2'
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    index === active ? 'bg-surface text-brand-ink' : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  <ModuleIcon name={item.icon} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">{item.label}</span>
                  <span className="block truncate text-caption text-ink-2">{item.description}</span>
                </span>
                <span className="shrink-0 text-caption text-ink-3">{item.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-ink-3">
        <span>↑ ↓ para moverse</span>
        <span className="flex items-center gap-1">
          <CornerDownLeft aria-hidden className="size-3" /> para abrir
        </span>
        <span>Esc para cerrar</span>
      </div>
    </dialog>
  );
}
