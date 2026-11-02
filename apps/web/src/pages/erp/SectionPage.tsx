import type { MeResponse } from '@quatreros/contracts';
import { CheckCircle2, Construction } from 'lucide-react';
import { useParams } from 'react-router';
import { areaLabelForSection, isUsable, SECTIONS, type Section } from '../../config/modules';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ModuleCard } from '../../components/ui/ModuleCard';
import { ModuleIcon } from '../../components/ui/ModuleIcon';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ProductionPage } from './ProductionPage';

function NotFound() {
  useDocumentTitle('No encontrado');
  return (
    <div className="py-10">
      <EmptyState
        title="Esta sección no existe"
        description="Puede que el enlace esté desactualizado o que tu rol no tenga acceso."
      />
    </div>
  );
}

function SectionOverview({ section, me }: { section: Section; me: MeResponse }) {
  const usable = section.modules.filter((module) => isUsable(module, me));
  return (
    <section aria-labelledby="seccion-titulo" className="space-y-8">
      <PageHeader
        titleId="seccion-titulo"
        eyebrow={
          <>
            <ModuleIcon name={section.icon} className="size-3.5" />
            <span>
              {section.number} · {areaLabelForSection(section.id)}
            </span>
          </>
        }
        title={section.name}
        description={section.description}
        meta={
          <>
            <Badge tone={usable.length > 0 ? 'success' : 'neutral'}>
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${usable.length > 0 ? 'bg-success' : 'bg-ink-3'}`}
              />
              {usable.length} de {section.modules.length}{' '}
              {section.modules.length === 1 ? 'módulo disponible' : 'módulos disponibles'}
            </Badge>
            {usable.length === 0 ? (
              <Badge tone="warning">
                <Construction aria-hidden className="size-3" />
                Área en preparación
              </Badge>
            ) : null}
          </>
        }
      />

      {usable.length > 0 ? (
        <p className="flex items-center gap-2 text-caption text-ink-2">
          <CheckCircle2 aria-hidden className="size-3.5 text-success" />
          Solo se abren los módulos construidos y autorizados para tu rol.
        </p>
      ) : (
        <p className="text-body text-ink-2">
          Esta área todavía no tiene operaciones disponibles. Abajo se explica qué entrega activa cada módulo;
          no hay datos simulados.
        </p>
      )}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {section.modules.map((module) => (
          <li key={module.id}>
            <ModuleCard module={module} me={me} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Página de una sección del ERP. Producción tiene una composición propia (DEC-091, DEC-093). */
export function SectionPage({ me }: { me: MeResponse }) {
  const { id } = useParams();
  const section = SECTIONS.find((s) => s.id === id && s.id !== 'inicio');
  useDocumentTitle(section?.name ?? 'No encontrado');

  if (!section) return <NotFound />;
  if (section.id === 'produccion') return <ProductionPage me={me} />;
  return <SectionOverview section={section} me={me} />;
}
