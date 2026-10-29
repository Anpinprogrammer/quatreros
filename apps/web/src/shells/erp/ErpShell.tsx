import type { MeResponse } from '@quatreros/contracts';
import { useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router';
import { UsersPage } from '../../features/usuarios/UsersPage';
import { hasPermission } from '../../shared/auth/session';
import { MODULE_GROUPS, statusLabel, type ModuleEntry, type ModuleStatus } from '../../shared/modules';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

const badge: Record<ModuleStatus['kind'], string> = {
  available: 'bg-chimichurri-soft text-chimichurri-strong',
  pending: 'bg-surface text-ink-muted',
  blocked: 'bg-brasa-soft text-ink',
};

function ModuleItem({
  module,
  me,
  onNavigate,
}: {
  module: ModuleEntry;
  me: MeResponse;
  onNavigate: () => void;
}) {
  const usable =
    module.status.kind === 'available' &&
    module.path &&
    (!module.permission || hasPermission(me, module.permission));
  const chip = (
    <span className={`mt-0.5 inline-block rounded-control px-1.5 text-sm ${badge[module.status.kind]}`}>
      {statusLabel(module.status)}
    </span>
  );
  if (usable && module.path) {
    return (
      <NavLink
        to={module.path}
        onClick={onNavigate}
        className={({ isActive }) =>
          `block rounded-control px-2 py-1.5 hover:bg-chimichurri-soft ${isActive ? 'bg-chimichurri-soft ring-1 ring-chimichurri' : ''}`
        }
      >
        <span className="flex items-center justify-between font-semibold text-chimichurri-strong">
          {module.name}
          <span aria-hidden>›</span>
        </span>
        {chip}
      </NavLink>
    );
  }
  // Módulos aún no utilizables: atenuados para que no parezcan enlaces.
  return (
    <div className="rounded-control px-2 py-1.5">
      <span className="block text-ink-muted">{module.name}</span>
      {chip}
    </div>
  );
}

function Welcome({ me }: { me: MeResponse }) {
  useDocumentTitle('Inicio');
  const available = MODULE_GROUPS.flatMap((g) => g.modules).filter(
    (m) => m.status.kind === 'available' && m.path && (!m.permission || hasPermission(me, m.permission)),
  );
  return (
    <>
      <h1 className="text-2xl font-bold">Hola, {me.user.fullName.split(' ')[0]}</h1>
      <p className="mt-2 text-ink-muted">
        Sedes asignadas: {me.sites.map((s) => s.name).join(', ') || 'ninguna'}.
      </p>
      {available.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-bold">Puedes usar</h2>
          <ul className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-2">
            {available.map((m) => (
              <li key={m.id}>
                <Link
                  to={m.path ?? '/erp'}
                  className="block rounded-panel border border-line bg-panel p-4 hover:ring-1 hover:ring-chimichurri"
                >
                  <span className="font-semibold text-chimichurri-strong">{m.name} ›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-8 max-w-prose text-sm text-ink-muted">
        Los demás módulos se habilitan a medida que se construyen. Los marcados &quot;Espera decisión&quot;
        dependen de una definición del negocio pendiente.
      </p>
    </>
  );
}

function NotFound() {
  useDocumentTitle('No encontrado');
  return <p className="text-ink-muted">Esta sección no existe o no tienes acceso.</p>;
}

/** Shell ERP (ADR-014): navegación por proceso de negocio con el estado real de cada módulo. */
export function ErpShell({ me }: { me: MeResponse }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[18rem_1fr]">
      <a
        href="#contenido"
        className="sr-only z-10 rounded-control bg-panel px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <nav
        aria-label="Módulos"
        className="border-b border-line bg-panel p-4 md:min-h-dvh md:border-r md:border-b-0"
      >
        <div className="flex items-center justify-between gap-3 md:mb-6">
          <Link to="/erp" className="text-lg font-bold text-chimichurri-strong">
            Quatreros
          </Link>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="lista-modulos"
            onClick={() => {
              setMenuOpen((v) => !v);
            }}
            className="min-h-11 rounded-control px-4 font-semibold ring-1 ring-control md:hidden"
          >
            {menuOpen ? 'Cerrar menú' : 'Menú'}
          </button>
        </div>
        <div id="lista-modulos" className={`${menuOpen ? 'mt-4 block' : 'hidden'} md:block`}>
          {MODULE_GROUPS.map((group) => (
            <section key={group.process} className="mb-5">
              <h2 className="mb-1.5 text-sm font-semibold text-ink-muted">{group.process}</h2>
              <ul className="space-y-1">
                {group.modules.map((m) => (
                  <li key={m.id}>
                    <ModuleItem
                      module={m}
                      me={me}
                      onNavigate={() => {
                        setMenuOpen(false);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-6 py-3">
          <ServerStatus />
          <UserMenu me={me} />
        </header>
        <main id="contenido" tabIndex={-1} className="p-6 outline-none md:p-10">
          <Routes>
            <Route index element={<Welcome me={me} />} />
            {hasPermission(me, 'adm.user.read') ? (
              <Route path="usuarios" element={<UsersPage me={me} />} />
            ) : null}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
