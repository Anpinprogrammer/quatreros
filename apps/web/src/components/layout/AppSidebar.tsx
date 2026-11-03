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
              <div aria-hidden className="mx-2 mb-2 border-t border-[var(--shell-sidebar-border)]" />
            ) : (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.14em] text-[var(--shell-sidebar-muted)] uppercase">
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
                          ? 'bg-[var(--shell-sidebar-active)] text-[var(--shell-sidebar-text)]'
                          : 'text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      <span
                        aria-hidden
                        className={`absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--shell-sidebar-accent)] transition-opacity ${current ? 'opacity-100' : 'opacity-0'}`}
                      />
                      <ModuleIcon
                        name={section.icon}
                        className={`size-[18px] shrink-0 ${current ? 'text-[var(--shell-sidebar-accent)]' : ''}`}
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
      className={`app-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-200 lg:flex ${collapsed ? 'w-[72px]' : 'w-[248px]'}`}
    >
      <div
        className={`flex h-[72px] shrink-0 items-center border-b border-[var(--shell-sidebar-border)] ${collapsed ? 'justify-center px-0' : 'px-4'}`}
      >
        <Brand to="/erp" compact={collapsed} inverse />
      </div>
      <SidebarNav me={me} collapsed={collapsed} />
      <div className="shrink-0 border-t border-[var(--shell-sidebar-border)] p-3">
        <ServerStatus compact={collapsed} variant="sidebar" />
      </div>
    </aside>
  );
}

/** Navegación móvil en panel deslizante. */
export function MobileSidebar({ me, open, onClose }: { me: MeResponse; open: boolean; onClose: () => void }) {
  return (
    <ResponsiveDrawer open={open} onClose={onClose} title="Navegación" variant="dark">
      <div className="mb-3 border-b border-[var(--shell-sidebar-border)] px-2 pb-4">
        <Brand to="/erp" inverse />
      </div>
      <SidebarNav me={me} onNavigate={onClose} />
      <div className="mt-4 border-t border-[var(--shell-sidebar-border)] px-2 pt-4">
        <ServerStatus variant="sidebar" />
      </div>
    </ResponsiveDrawer>
  );
}
