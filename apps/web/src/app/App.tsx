import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { LoginPage } from '../pages/acceso/LoginPage';
import { MfaSetupPage } from '../pages/acceso/MfaSetupPage';
import { ApiError } from '../services/client';
import { FullPageMessage, RequireSession } from '../components/auth/RequireSession';
import { ME_KEY } from '../hooks/useSession';
import { ToastProvider } from '../components/ui/Toast';

// Cada shell se carga por separado (división de código, ADR-014).
const ErpShell = lazy(() => import('../pages/erp/ErpShell').then((m) => ({ default: m.ErpShell })));
const PosShell = lazy(() => import('../pages/pos/PosShell').then((m) => ({ default: m.PosShell })));
const RutaShell = lazy(() => import('../pages/ruta/RutaShell').then((m) => ({ default: m.RutaShell })));

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-caption tracking-[0.2em] text-ink-3 uppercase">404</p>
        <h1 className="mt-2 font-display text-display font-bold text-ink">Esta página no existe</h1>
        <p className="mt-2 text-body text-ink-2">Revisa el enlace o vuelve al inicio para continuar.</p>
        <a
          className="mt-5 inline-flex min-h-[52px] items-center rounded-xl bg-brand px-5 text-action font-bold text-white hover:bg-brand-hover"
          href="/"
        >
          Volver al inicio
        </a>
      </div>
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
      <ToastProvider>
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
      </ToastProvider>
    </QueryClientProvider>
  );
}
