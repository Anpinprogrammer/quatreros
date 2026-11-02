import type { MeResponse } from '@quatreros/contracts';
import { Link, useLocation } from 'react-router';
import { SIDEBAR_GROUPS, sectionForPath, visibleSections, type Section } from '../../config/modules';
import { Brand } from '../ui/Brand';
import { ModuleIcon } from '../ui/ModuleIcon';
import { ResponsiveDrawer } from '../ui/ResponsiveDrawer';
import { ServerStatus } from '../ui/ServerStatus';

function SidebarNav({
  me,
  collapsed = false,
  onNavigate,
}: {
  me: MeResponse;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const active = sectionForPath(location.pathname);
  const visible = visibleSections(me);

  return (
    <nav aria-label="Secciones" className="scroll-thin flex-1 overflow-y-auto px-3 py-4">
      {SIDEBAR_GROUPS.map((group, groupIndex) => {
        const sections = group.sectionIds
          .map((id) => visible.find((s) => s.id === id))
          .filter((s): s is Section => Boolean(s));
        if (sections.length === 0) return null;
        return (
          <div key={group.id} className={groupIndex === 0 ? '' : 'mt-5'}>
            {collapsed ? (
              <div aria-hidden className="mx-2 mb-2 border-t border-line" />
            ) : (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {sections.map((section) => {
                const current = active?.id === section.id;
                return (
                  <li key={section.id}>
                    <Link
                      to={section.path}
                      aria-current={current ? 'page' : undefined}
                      aria-label={section.name}
                      title={collapsed ? section.name : undefined}
                      onClick={onNavigate}
                      className={`relative flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-body font-semibold transition-colors duration-200 ${
                        current
                          ? 'bg-brand-soft text-brand-ink'
                          : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      <span
                        aria-hidden
                        className={`absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-opacity ${current ? 'opacity-100' : 'opacity-0'}`}
                      />
                      <ModuleIcon
                        name={section.icon}
                        className={`size-[18px] shrink-0 ${current ? 'text-brand-ink' : ''}`}
                      />
                      <span className={collapsed ? 'sr-only' : 'truncate'}>{section.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Barra lateral de escritorio: 248 px expandida, 72 px contraída. */
export function AppSidebar({ me, collapsed }: { me: MeResponse; collapsed: boolean }) {
  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? 'w-[72px]' : 'w-[248px]'}`}
    >
      <div
        className={`flex h-[72px] shrink-0 items-center border-b border-line ${collapsed ? 'justify-center px-0' : 'px-4'}`}
      >
        <Brand to="/erp" compact={collapsed} />
      </div>
      <SidebarNav me={me} collapsed={collapsed} />
      <div className="shrink-0 border-t border-line p-3">
        <ServerStatus compact={collapsed} />
      </div>
    </aside>
  );
}

/** Navegación móvil en panel deslizante. */
export function MobileSidebar({ me, open, onClose }: { me: MeResponse; open: boolean; onClose: () => void }) {
  return (
    <ResponsiveDrawer open={open} onClose={onClose} title="Navegación">
      <div className="mb-3 border-b border-line px-2 pb-4">
        <Brand to="/erp" />
      </div>
      <SidebarNav me={me} onNavigate={onClose} />
      <div className="mt-4 border-t border-line px-2 pt-4">
        <ServerStatus />
      </div>
    </ResponsiveDrawer>
  );
}
