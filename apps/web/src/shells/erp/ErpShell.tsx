import type { MeResponse } from '@quatreros/contracts';
import { Link, NavLink, Route, Routes } from 'react-router';
import { UsersPage } from '../../features/usuarios/UsersPage';
import { hasPermission } from '../../shared/auth/session';
import { MODULE_GROUPS, statusLabel, type ModuleEntry, type ModuleStatus } from '../../shared/modules';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';

const badge: Record<ModuleStatus['kind'], string> = {
  available: 'bg-chimichurri-soft text-chimichurri-strong',
  pending: 'bg-surface text-ink-muted ring-1 ring-line',
  blocked: 'bg-brasa-soft text-ink',
};

function ModuleItem({ module, me }: { module: ModuleEntry; me: MeResponse }) {
  const usable =
    module.status.kind === 'available' &&
    module.path &&
    (!module.permission || hasPermission(me, module.permission));
  const content = (
    <>
      <span className="block font-semibold">{module.name}</span>
      <span className={`mt-0.5 inline-block rounded px-1.5 text-sm ${badge[module.status.kind]}`}>
        {statusLabel(module.status)}
      </span>
    </>
  );
  if (usable && module.path) {
    return (
      <NavLink
        to={module.path}
        className={({ isActive }) =>
          `block rounded-control px-2 py-1.5 hover:bg-surface ${isActive ? 'bg-surface ring-1 ring-chimichurri' : ''}`
        }
      >
        {content}
      </NavLink>
    );
  }
  return <div className="rounded-control px-2 py-1.5">{content}</div>;
}

function Welcome({ me }: { me: MeResponse }) {
  return (
    <>
      <h1 className="text-2xl font-bold">Hola, {me.user.fullName.split(' ')[0]}</h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        Los módulos se habilitan a medida que se construye cada funcionalidad completa. Los que esperan una
        decisión del negocio muestran la clave de esa decisión en el registro del proyecto.
      </p>
      <p className="mt-4 max-w-prose text-ink-muted">
        Sedes asignadas: {me.sites.map((s) => s.name).join(', ') || 'ninguna'}.
      </p>
    </>
  );
}

/** Shell ERP (ADR-014): navegación por proceso de negocio con el estado real de cada módulo. */
export function ErpShell({ me }: { me: MeResponse }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[18rem_1fr]">
      <nav
        aria-label="Módulos"
        className="border-b border-line bg-panel p-4 md:min-h-dvh md:border-r md:border-b-0"
      >
        <Link to="/erp" className="mb-6 block text-lg font-bold text-chimichurri-strong">
          Quatreros
        </Link>
        {MODULE_GROUPS.map((group) => (
          <section key={group.process} className="mb-5">
            <h2 className="mb-1.5 text-sm font-semibold text-ink-muted">{group.process}</h2>
            <ul className="space-y-1">
              {group.modules.map((m) => (
                <li key={m.id}>
                  <ModuleItem module={m} me={me} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-6 py-3">
          <ServerStatus />
          <UserMenu me={me} />
        </header>
        <main className="p-6 md:p-10">
          <Routes>
            <Route index element={<Welcome me={me} />} />
            {hasPermission(me, 'adm.user.read') ? (
              <Route path="usuarios" element={<UsersPage me={me} />} />
            ) : null}
            <Route
              path="*"
              element={<p className="text-ink-muted">Esta sección no existe o no tienes acceso.</p>}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
