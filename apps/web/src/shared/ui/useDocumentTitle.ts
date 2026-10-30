import { useEffect } from 'react';

/** Título de pestaña por pantalla (WCAG 2.4.2): "Usuarios · Quatreros". */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · Quatreros` : 'Quatreros';
  }, [title]);
}
