import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { LoginPage } from '../features/acceso/LoginPage';
import { MfaSetupPage } from '../features/acceso/MfaSetupPage';
import { ApiError } from '../shared/api/client';
import { FullPageMessage, ME_KEY, RequireSession } from '../shared/auth/session';

// Cada shell se carga por separado (división de código, ADR-014).
const ErpShell = lazy(() => import('../shells/erp/ErpShell').then((m) => ({ default: m.ErpShell })));
const PosShell = lazy(() => import('../shells/pos/PosShell').then((m) => ({ default: m.PosShell })));
const RutaShell = lazy(() => import('../shells/ruta/RutaShell').then((m) => ({ default: m.RutaShell })));

function NotFound() {
  return (
    <main className="p-10">
      <h1 className="text-xl font-bold">Esta página no existe</h1>
      <a className="mt-2 inline-block text-chimichurri underline" href="/">
        Volver al inicio
      </a>
    </main>
  );
}

function makeQueryClient() {
  const client: QueryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
    // Si una consulta revela que la sesión venció o falta el segundo factor, se vuelve a evaluar la sesión.
    queryCache: new QueryCache({
      onError: (err) => {
        if (err instanceof ApiError && (err.status === 401 || err.code === 'MFA_SETUP_REQUIRED')) {
          void client.invalidateQueries({ queryKey: ME_KEY });
        }
      },
    }),
  });
  return client;
}

export function App() {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<FullPageMessage>Cargando…</FullPageMessage>}>
          <Routes>
            <Route path="/ingresar" element={<LoginPage />} />
            <Route path="/seguridad/segundo-factor" element={<MfaSetupPage />} />
            <Route
              path="/"
              element={
                <RequireSession>{(me) => <Navigate to={`/${me.homeShell}`} replace />}</RequireSession>
              }
            />
            <Route
              path="/erp/*"
              element={<RequireSession shell="erp">{(me) => <ErpShell me={me} />}</RequireSession>}
            />
            <Route
              path="/pos/*"
              element={<RequireSession shell="pos">{(me) => <PosShell me={me} />}</RequireSession>}
            />
            <Route
              path="/ruta/*"
              element={<RequireSession shell="ruta">{(me) => <RutaShell me={me} />}</RequireSession>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
