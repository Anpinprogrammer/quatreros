import type { MeResponse } from '@quatreros/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ErpShell } from './ErpShell';

const admin: MeResponse = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    fullName: 'Ana Administradora',
    email: 'admin@quatreros.example',
  },
  roles: [{ code: 'ADM', name: 'Administrador' }],
  sites: [],
  permissions: { 'adm.user.read': 'ALL' },
  mfa: { required: true, enabled: true },
  homeShell: 'erp',
};

function renderShell(me: MeResponse, path = '/erp') {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/erp/*" element={<ErpShell me={me} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ErpShell', () => {
  it('muestra las pestañas del encabezado y el Command Center sin cifras inventadas', () => {
    renderShell(admin);
    const tabs = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(tabs).getByRole('link', { name: /Command Center/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: /Producción/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Command Center' })).toBeInTheDocument();
    expect(screen.getByText('Hola, Ana')).toBeInTheDocument();
    // Las tarjetas del tablero dicen qué entrega las activa.
    expect(screen.getAllByText(/Se activa con la entrega/).length).toBeGreaterThan(0);
  });

  it('una sección muestra sus módulos con la clave de la decisión pendiente', () => {
    renderShell(admin, '/erp/seccion/produccion');
    expect(screen.getByRole('heading', { name: 'Producción' })).toBeInTheDocument();
    expect(screen.getByText('Espera decisión P-06')).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: /Producción/ }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('el administrador tiene acceso directo a Usuarios', () => {
    renderShell(admin);
    const shortcuts = screen.getByRole('region', { name: 'Puedes usar' });
    expect(within(shortcuts).getByRole('link', { name: /Usuarios y permisos/ })).toHaveAttribute(
      'href',
      '/erp/usuarios',
    );
  });

  it('sin permiso adm.user.read el módulo se muestra sin enlace', () => {
    renderShell(
      { ...admin, roles: [{ code: 'PROD', name: 'Productor' }], permissions: {} },
      '/erp/seccion/administracion',
    );
    expect(screen.queryByRole('link', { name: /Usuarios y permisos/ })).toBeNull();
    expect(screen.getByText('Usuarios y permisos')).toBeInTheDocument();
  });
});
