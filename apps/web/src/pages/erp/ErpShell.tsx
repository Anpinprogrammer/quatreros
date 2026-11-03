import type { MeResponse } from '@quatreros/contracts';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import { CatalogPage } from '../catalogo/CatalogPage';
import { ProductPage } from '../catalogo/ProductPage';
import { PurchasePage } from '../compras/PurchasePage';
import { DispatchPage } from '../ventas/DispatchPage';
import { SalesOrderPage } from '../ventas/SalesOrderPage';
import { VentasPage } from '../ventas/VentasPage';
import { OrderPage } from '../produccion/OrderPage';
import { ProductionPage } from '../produccion/ProductionPage';
import { RecipePage } from '../produccion/RecipePage';
import { PurchasesPage } from '../compras/PurchasesPage';
import { ExistenciasPage } from '../existencias/ExistenciasPage';
import { LotePage } from '../existencias/LotePage';
import { TransferPage } from '../existencias/TransferPage';
import { UsersPage } from '../usuarios/UsersPage';
import { CarteraPage } from '../finanzas/CarteraPage';
import { HechosPage } from '../finanzas/HechosPage';
import { AssistantPage } from '../ia/AssistantPage';
import { CashReviewPage } from '../pos/CashReviewPage';
import { DishRecipesPage } from '../pos/DishRecipesPage';
import { hasPermission } from '../../lib/session';
import { EmptyState } from '../../components/ui/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AppHeader } from '../../components/layout/AppHeader';
import { AppSidebar, MobileSidebar } from '../../components/layout/AppSidebar';
import { AssistantWidget } from '../../components/layout/AssistantWidget';
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
  const [assistantOpen, setAssistantOpen] = useState(false);

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
          {/* Atenúa el contenido sin tocar la barra lateral ni el encabezado. */}
          {assistantOpen ? (
            <div
              aria-hidden
              className={`pointer-events-none fixed inset-x-0 top-[72px] bottom-0 z-20 bg-[#0B0D10]/25 ${
                collapsed ? 'lg:left-[72px]' : 'lg:left-[248px]'
              }`}
            />
          ) : null}
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
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 outline-none md:px-8 md:pt-8 lg:pb-8"
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
              {hasPermission(me, 'pos.cash_variance.review') ? (
                <Route path="pos/revision" element={<CashReviewPage />} />
              ) : null}
              {hasPermission(me, 'pos.dish_recipe.manage') ? (
                <Route path="pos/recetas" element={<DishRecipesPage />} />
              ) : null}
              {hasPermission(me, 'fin.receivable.read') ? (
                <Route path="cartera" element={<CarteraPage me={me} />} />
              ) : null}
              {hasPermission(me, 'cont.report.read') ? (
                <Route path="contabilidad/hechos" element={<HechosPage />} />
              ) : null}
              {hasPermission(me, 'ia.query') ? (
                <Route path="ia/asistente" element={<AssistantPage me={me} />} />
              ) : null}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
      <AssistantWidget me={me} onOpenChange={setAssistantOpen} />
    </div>
  );
}
