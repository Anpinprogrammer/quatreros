import { Link } from 'react-router';
import { MODULE_GROUPS, statusLabel, type ModuleStatus } from '../../shared/modules';
import { ServerStatus } from '../../shared/ui/ServerStatus';

const badge: Record<ModuleStatus['kind'], string> = {
  available: 'bg-chimichurri-soft text-chimichurri-strong',
  pending: 'bg-surface text-ink-muted ring-1 ring-line',
  blocked: 'bg-brasa-soft text-ink',
};

/** Shell ERP (ADR-014): navegación por proceso de negocio con el estado real de cada módulo. */
export function ErpShell() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[18rem_1fr]">
      <nav
        aria-label="Módulos"
        className="border-b border-line bg-panel p-4 md:min-h-dvh md:border-r md:border-b-0"
      >
        <Link to="/" className="mb-6 block text-lg font-bold text-chimichurri-strong">
          Quatreros
        </Link>
        {MODULE_GROUPS.map((group) => (
          <section key={group.process} className="mb-5">
            <h2 className="mb-1.5 text-sm font-semibold text-ink-muted">{group.process}</h2>
            <ul className="space-y-1">
              {group.modules.map((m) => (
                <li key={m.id} className="rounded-control px-2 py-1.5">
                  <span className="block font-semibold">{m.name}</span>
                  <span className={`mt-0.5 inline-block rounded px-1.5 text-sm ${badge[m.status.kind]}`}>
                    {statusLabel(m.status)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <main className="p-6 md:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold">Administración</h1>
          <ServerStatus />
        </div>
        <p className="mt-4 max-w-prose text-ink-muted">
          Los módulos se habilitan a medida que se construye cada funcionalidad completa. Los que esperan una
          decisión del negocio muestran la clave de esa decisión en el registro del proyecto.
        </p>
      </main>
    </div>
  );
}
