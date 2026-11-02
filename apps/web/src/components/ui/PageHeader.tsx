import type { ReactNode, Ref } from 'react';

/**
 * Encabezado de pantalla: contexto, título, descripción y acciones.
 * El título es el único h1 de la página; el encabezado global solo muestra migas de pan.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  titleId,
  titleRef,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  titleId?: string;
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 flex items-center gap-2 text-caption font-semibold tracking-[0.12em] text-ink-2 uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1
          id={titleId}
          ref={titleRef}
          tabIndex={titleRef ? -1 : undefined}
          className="font-display text-display font-bold text-ink outline-none [text-wrap:balance]"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-body text-ink-2 md:text-[15px] md:leading-6">{description}</p>
        ) : null}
        {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
