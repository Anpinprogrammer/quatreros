import type { MeResponse } from '@quatreros/contracts';
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router';
import { UsersPage } from '../../features/usuarios/UsersPage';
import { hasPermission } from '../../shared/auth/session';
import {
  isUsable,
  SECTIONS,
  sectionForPath,
  statusLabel,
  type ModuleEntry,
  type ModuleStatus,
} from '../../shared/modules';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Brand } from '../../shared/ui/Brand';
import { Card } from '../../shared/ui/Card';
import { ServerStatus } from '../../shared/ui/ServerStatus';
import { UserMenu } from '../../shared/ui/UserMenu';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { CommandCenter } from './CommandCenter';

const statusTone: Record<ModuleStatus['kind'], BadgeTone> = {
  available: 'success',
  pending: 'neutral',
  blocked: 'warning',
};

function ModuleCard({ module, me }: { module: ModuleEntry; me: MeResponse }) {
  const usable = isUsable(module, me);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className={`text-title font-semibold ${usable ? 'text-chalk' : 'text-ash'}`}>{module.name}</h2>
        {usable ? (
          <span aria-hidden className="text-title text-ember">
            ›
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-ash">{module.description}</p>
      <div className="mt-4">
        <Badge tone={statusTone[module.status.kind]}>{statusLabel(module.status)}</Badge>
      </div>
    </>
  );
  if (usable && module.path) {
    return (
      <Link to={module.path} className="block rounded-2xl">
        <Card interactive className="h-full">
          {body}
        </Card>
      </Link>
    );
  }
  return <Card className="h-full">{body}</Card>;
}

function SectionPage({ me }: { me: MeResponse }) {
  const { id } = useParams();
  const section = SECTIONS.find((s) => s.id === id && s.id !== 'inicio');
  useDocumentTitle(section?.name ?? 'No encontrado');
  if (!section) return <NotFound />;
  return (
    <>
      <p className="font-mono text-caption text-ash">{section.number}</p>
      <h1 className="text-display font-bold">{section.name}</h1>
      <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {section.modules.map((m) => (
          <li key={m.id}>
            <ModuleCard module={m} me={me} />
          </li>
        ))}
      </ul>
    </>
  );
}

function NotFound() {
  useDocumentTitle('No encontrado');
  return <p className="text-ash">Esta sección no existe o no tienes acceso.</p>;
}

/** Pestañas del encabezado (Parte 2): una por sección, con desplazamiento horizontal en pantallas angostas. */
function SectionTabs() {
  const location = useLocation();
  const active = sectionForPath(location.pathname);
  return (
    <nav aria-label="Secciones" className="border-b border-grill bg-char">
      <ul className="mx-auto flex max-w-[96rem] gap-1 overflow-x-auto px-4 md:px-6">
        {SECTIONS.map((s) => {
          const current = active?.id === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <NavLink
                to={s.path}
                end={s.id === 'inicio'}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-body font-semibold whitespace-nowrap transition-colors duration-200 ${current ? 'border-ember text-chalk' : 'border-transparent text-ash hover:text-chalk'}`}
              >
                <span aria-hidden className={`font-mono text-caption ${current ? 'text-ember' : ''}`}>
                  {s.number}.
                </span>
                {s.name}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Shell ERP: encabezado de la plataforma y pestañas por sección (sistema de diseño, Parte 2). */
export function ErpShell({ me }: { me: MeResponse }) {
  const sites = me.sites.map((s) => s.name);
  return (
    <div className="min-h-dvh bg-char">
      <a
        href="#contenido"
        className="sr-only z-20 rounded-xl bg-smoke px-4 py-3 font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-grill bg-smoke">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 md:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Brand to="/erp" />
            {sites.length > 0 ? (
              <p className="rounded-lg border border-grill-strong bg-grill px-3 py-1.5 text-caption text-ash">
                {sites.length === 1 ? 'Sede: ' : 'Sedes: '}
                <span className="font-semibold text-chalk">{sites.join(', ')}</span>
              </p>
            ) : null}
            <ServerStatus />
          </div>
          <UserMenu me={me} />
        </div>
      </header>
      <SectionTabs />
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-[96rem] p-4 outline-none md:p-8">
        <Routes>
          <Route index element={<CommandCenter me={me} />} />
          <Route path="seccion/:id" element={<SectionPage me={me} />} />
          {hasPermission(me, 'adm.user.read') ? (
            <Route path="usuarios" element={<UsersPage me={me} />} />
          ) : null}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
