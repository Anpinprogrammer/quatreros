import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Home } from '../shells/Home';

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

export function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<p className="p-10 text-ink-muted">Cargando…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/erp/*" element={<ErpShell />} />
            <Route path="/pos/*" element={<PosShell />} />
            <Route path="/ruta/*" element={<RutaShell />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
