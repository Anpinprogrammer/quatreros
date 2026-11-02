import type { MeResponse } from '@quatreros/contracts';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import { CatalogPage } from '../../features/catalogo/CatalogPage';
import { ProductPage } from '../../features/catalogo/ProductPage';
import { PurchasePage } from '../../features/compras/PurchasePage';
import { DispatchPage } from '../../features/ventas/DispatchPage';
import { SalesOrderPage } from '../../features/ventas/SalesOrderPage';
import { VentasPage } from '../../features/ventas/VentasPage';
import { OrderPage } from '../../features/produccion/OrderPage';
import { ProductionPage } from '../../features/produccion/ProductionPage';
import { RecipePage } from '../../features/produccion/RecipePage';
import { PurchasesPage } from '../../features/compras/PurchasesPage';
import { ExistenciasPage } from '../../features/existencias/ExistenciasPage';
import { LotePage } from '../../features/existencias/LotePage';
import { TransferPage } from '../../features/existencias/TransferPage';
import { UsersPage } from '../../features/usuarios/UsersPage';
import { hasPermission } from '../../shared/auth/session';
import { EmptyState } from '../../shared/ui/EmptyState';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { AppHeader } from './AppHeader';
import { AppSidebar, MobileSidebar } from './AppSidebar';
import { CommandCenter } from './CommandCenter';
import { SectionPage } from './SectionPage';

const SIDEBAR_KEY = 'quatreros-sidebar';

function NotFound() {
  useDocumentTitle('No encontrado');
  return (
    <div className="py-10">
      <EmptyState
        title="Esta página no existe"
        description="Revisa el enlace o vuelve al Command Center para continuar."
      />
    </div>
  );
}

/** Shell ERP: barra lateral, encabezado global y contenido por secciones. */
export function ErpShell({ me }: { me: MeResponse }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        // Sin almacenamiento persistente: la preferencia dura la sesión.
      }
      return next;
    });
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#contenido"
        className="sr-only z-[80] rounded-xl bg-surface px-4 py-3 font-semibold shadow-float focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <div className="flex">
        <AppSidebar me={me} collapsed={collapsed} />
        <MobileSidebar
          me={me}
          open={mobileNavOpen}
          onClose={() => {
            setMobileNavOpen(false);
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            me={me}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onOpenNav={() => {
              setMobileNavOpen(true);
            }}
          />
          <main
            id="contenido"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 outline-none md:px-8 md:py-8"
          >
            <Routes>
              <Route index element={<CommandCenter me={me} />} />
              <Route path="seccion/:id" element={<SectionPage me={me} />} />
              {hasPermission(me, 'adm.user.read') ? (
                <Route path="usuarios" element={<UsersPage me={me} />} />
              ) : null}
              {hasPermission(me, 'cat.product.read') ? (
                <Route path="catalogo" element={<CatalogPage me={me} />} />
              ) : null}
              {hasPermission(me, 'cat.product.read') ? (
                <Route path="catalogo/productos/:id" element={<ProductPage me={me} />} />
              ) : null}
              {hasPermission(me, 'inv.stock.read') ? (
                <Route path="existencias" element={<ExistenciasPage me={me} />} />
              ) : null}
              {hasPermission(me, 'inv.stock.read') ? (
                <Route path="existencias/lotes/:id" element={<LotePage me={me} />} />
              ) : null}
              {hasPermission(me, 'inv.stock.read') ? (
                <Route path="existencias/traslados/:id" element={<TransferPage me={me} />} />
              ) : null}
              {hasPermission(me, 'comp.purchase.read') ? (
                <Route path="compras" element={<PurchasesPage me={me} />} />
              ) : null}
              {hasPermission(me, 'comp.purchase.read') ? (
                <Route path="compras/:id" element={<PurchasePage me={me} />} />
              ) : null}
              {hasPermission(me, 'prod.order.read') ? (
                <Route path="produccion" element={<ProductionPage me={me} />} />
              ) : null}
              {hasPermission(me, 'prod.order.read') ? (
                <Route path="produccion/:id" element={<OrderPage me={me} />} />
              ) : null}
              {hasPermission(me, 'prod.recipe.read') ? (
                <Route path="produccion/recetas/:id" element={<RecipePage me={me} />} />
              ) : null}
              {hasPermission(me, 'com.order.read') ? (
                <Route path="ventas" element={<VentasPage me={me} />} />
              ) : null}
              {hasPermission(me, 'com.order.read') ? (
                <Route path="ventas/pedidos/:id" element={<SalesOrderPage />} />
              ) : null}
              {hasPermission(me, 'dis.dispatch.read') ? (
                <Route path="ventas/despachos/:id" element={<DispatchPage me={me} />} />
              ) : null}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
