import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ErpShell } from './ErpShell';

describe('ErpShell', () => {
  it('muestra los módulos bloqueados con la clave de la decisión pendiente', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ErpShell />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('navigation', { name: 'Módulos' })).toBeInTheDocument();
    expect(screen.getByText('Espera decisión P-06')).toBeInTheDocument();
    expect(screen.getByText('Espera decisión P-01 a P-04')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando conexión');
  });
});
