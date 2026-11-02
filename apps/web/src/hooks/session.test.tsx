import type { MeResponse } from '@quatreros/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireSession } from './session';

const base: MeResponse = {
  user: {
    id: '00000000-0000-4000-8000-000000000002',
    fullName: 'Camila Caja',
    email: 'caja@quatreros.example',
  },
  roles: [{ code: 'CAJ', name: 'Cajero' }],
  sites: [],
  permissions: {},
  mfa: { required: false, enabled: false },
  homeShell: 'pos',
};

function mockMe(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

function renderAt(path: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ingresar" element={<p>pantalla de ingreso</p>} />
          <Route path="/seguridad/segundo-factor" element={<p>configurar segundo factor</p>} />
          <Route path="/pos" element={<p>caja</p>} />
          <Route path="/erp" element={<RequireSession shell="erp">{() => <p>erp</p>}</RequireSession>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequireSession', () => {
  it('sin sesión lleva a la pantalla de ingreso', async () => {
    mockMe(401, { type: 't', title: 'Sesión requerida', status: 401, code: 'UNAUTHENTICATED' });
    renderAt('/erp');
    expect(await screen.findByText('pantalla de ingreso')).toBeInTheDocument();
  });

  it('rol con segundo factor obligatorio sin configurar → configuración guiada', async () => {
    mockMe(200, {
      ...base,
      roles: [{ code: 'ADM', name: 'Administrador' }],
      mfa: { required: true, enabled: false },
    });
    renderAt('/erp');
    expect(await screen.findByText('configurar segundo factor')).toBeInTheDocument();
  });

  it('un cajero que entra al ERP es llevado a Caja', async () => {
    mockMe(200, base);
    renderAt('/erp');
    expect(await screen.findByText('caja')).toBeInTheDocument();
  });

  it('con acceso al shell muestra el contenido', async () => {
    mockMe(200, {
      ...base,
      roles: [{ code: 'MGR', name: 'Manager' }],
      mfa: { required: true, enabled: true },
    });
    renderAt('/erp');
    expect(await screen.findByText('erp')).toBeInTheDocument();
  });
});
