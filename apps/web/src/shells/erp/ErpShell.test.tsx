import type { MeResponse } from '@quatreros/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

function renderShell(me: MeResponse) {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/erp']}>
        <Routes>
          <Route path="/erp/*" element={<ErpShell me={me} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ErpShell', () => {
  it('muestra los módulos bloqueados con la clave de la decisión pendiente', () => {
    renderShell(admin);
    expect(screen.getByRole('navigation', { name: 'Módulos' })).toBeInTheDocument();
    expect(screen.getByText('Espera decisión P-06')).toBeInTheDocument();
    expect(screen.getByText('Espera decisión P-01 a P-04')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
  });

  it('el administrador ve el enlace a Usuarios; quien no tiene permiso, no', () => {
    renderShell(admin);
    const nav = screen.getByRole('navigation', { name: 'Módulos' });
    expect(within(nav).getByRole('link', { name: /Usuarios y permisos/ })).toHaveAttribute(
      'href',
      '/erp/usuarios',
    );
    // El inicio ofrece acceso directo a lo que el usuario sí puede usar.
    expect(screen.getByRole('heading', { name: 'Puedes usar' })).toBeInTheDocument();
  });

  it('en pantallas pequeñas el menú se abre y se cierra con su botón', () => {
    renderShell(admin);
    const toggle = screen.getByRole('button', { name: 'Menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('sin permiso adm.user.read el módulo se muestra sin enlace', () => {
    renderShell({ ...admin, roles: [{ code: 'PROD', name: 'Productor' }], permissions: {} });
    expect(screen.queryByRole('link', { name: /Usuarios y permisos/ })).toBeNull();
    expect(screen.getByText('Usuarios y permisos')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Puedes usar' })).toBeNull();
  });
});
