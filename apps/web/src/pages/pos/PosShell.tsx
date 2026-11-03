import type { MeResponse, PosCatalogItem, SaleDetail, ShiftDetail } from '@quatreros/contracts';
import { CreditCard, Minus, Plus, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Brand } from '../../components/ui/Brand';
import { Card, CardLabel } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { ServerStatus } from '../../components/ui/ServerStatus';
import { UserMenu } from '../../components/ui/UserMenu';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { hasPermission } from '../../lib/session';
import { formatMoney, formatQuantity } from '../../lib/format/pos';
import { newIdempotencyKey } from '../../services/client';
import { useCreateSale, useCurrentShift, usePosCatalog } from '../../services/pos';
import { CloseShiftDialog } from '../../components/pos/CloseShiftDialog';
import { PaymentForm } from '../../components/finanzas/PaymentForm';
import { OpenShiftPanel } from '../../components/pos/OpenShiftPanel';
import { PaymentDialog } from '../../components/pos/PaymentDialog';
import { PosDialog } from '../../components/pos/PosDialog';
import { SaleReceipt } from '../../components/pos/SaleReceipt';

interface TicketLine {
  item: PosCatalogItem;
  quantity: number;
}

/** Terminal POS: abrir turno, vender con pago mixto y cerrar con arqueo (RF-220..224). */
export function PosShell({ me }: { me: MeResponse }) {
  useDocumentTitle('Caja');
  const site = me.sites.find((item) => item.kind === 'point_of_sale') ?? me.sites[0];
  const shift = useCurrentShift(site?.id);
  const catalog = usePosCatalog(site?.id);
  const createSale = useCreateSale();
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [saleKey, setSaleKey] = useState(newIdempotencyKey);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingShiftId, setClosingShiftId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SaleDetail | null>(null);
  const [closedShift, setClosedShift] = useState<ShiftDetail | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const canCollectPortfolio = hasPermission(me, 'fin.receivable_payment.create');

  if (!site) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-6">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="Sin punto de venta asignado"
          description="Pide a un administrador que te asigne una sede de tipo punto de venta."
        />
      </main>
    );
  }

  const total = ticket.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0);
  const methods = catalog.data?.paymentMethods ?? [];

  const add = (item: PosCatalogItem) => {
    if (!item.sellable) return;
    setReceipt(null);
    setTicket((current) => {
      const existing = current.find((line) => line.item.presentationId === item.presentationId);
      if (existing) {
        return current.map((line) =>
          line.item.presentationId === item.presentationId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { item, quantity: 1 }];
    });
  };

  const changeQuantity = (presentationId: string, delta: number) => {
    setTicket((current) =>
      current
        .map((line) =>
          line.item.presentationId === presentationId ? { ...line, quantity: line.quantity + delta } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const confirmSale = (payments: { paymentMethodId: string; amount: string }[]) => {
    if (!shift.data) return;
    createSale.mutate(
      {
        input: {
          shiftId: shift.data.id,
          lines: ticket.map((line) => ({
            presentationId: line.item.presentationId,
            quantity: line.quantity.toFixed(3),
          })),
          payments,
        },
        idempotencyKey: saleKey,
      },
      {
        onSuccess: (res) => {
          setReceipt(res.data);
          setTicket([]);
          setPaymentOpen(false);
          setSaleKey(newIdempotencyKey());
        },
      },
    );
  };

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-header backdrop-blur-xl">
        <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6">
          <div className="flex flex-wrap items-center gap-2 md:gap-5">
            <Brand to="/" area="Caja" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-caption font-semibold whitespace-nowrap text-ink-2">
              <Wallet aria-hidden className="size-3.5 text-brand-ink" />
              {site.name}
            </span>
            <Badge tone={shift.data ? 'success' : 'neutral'}>
              {shift.data ? 'Turno abierto' : 'Turno cerrado'}
            </Badge>
            <span className="hidden sm:block">
              <ServerStatus />
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canCollectPortfolio ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setCollectOpen(true);
                }}
              >
                Cobrar cartera
              </Button>
            ) : null}
            {shift.data && methods.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setClosingShiftId(shift.data?.id ?? null);
                  setCloseOpen(true);
                }}
              >
                Cerrar turno
              </Button>
            ) : null}
            <UserMenu me={me} showName />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] content-start gap-4 p-4 md:grid-cols-[minmax(0,1fr)_24rem] md:p-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {shift.isPending || catalog.isPending ? (
          <div className="md:col-span-2">
            <LoadingSkeleton label="Cargando caja…" rows={4} />
          </div>
        ) : catalog.error ? (
          <div className="md:col-span-2">
            <Alert tone="error">{catalog.error.message}</Alert>
          </div>
        ) : !shift.data ? (
          <div className="mx-auto w-full max-w-3xl space-y-6 md:col-span-2">
            {closedShift ? (
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardLabel>Turno cerrado</CardLabel>
                    <p className="mt-1 font-display text-title font-bold text-ink">
                      {closedShift.status === 'closed_with_variance' ? 'Cerrado con diferencia' : 'Cerrado'}
                    </p>
                  </div>
                  <Badge tone={closedShift.status === 'closed_with_variance' ? 'warning' : 'success'}>
                    {closedShift.status === 'closed_with_variance'
                      ? 'Pendiente de revisión'
                      : 'Sin diferencia'}
                  </Badge>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-caption text-ink-2">Efectivo esperado</dt>
                    <dd className="font-mono text-body text-ink">
                      {formatMoney(closedShift.cashExpected ?? '0')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-2">Efectivo contado</dt>
                    <dd className="font-mono text-body text-ink">
                      {formatMoney(closedShift.cashCounted ?? '0')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-2">Diferencia</dt>
                    <dd className="font-mono text-body font-semibold text-ink">
                      {formatMoney(closedShift.cashDifference ?? '0')}
                    </dd>
                  </div>
                </dl>
                {closedShift.closingNote ? (
                  <p className="mt-3 text-caption text-ink-2">{closedShift.closingNote}</p>
                ) : null}
              </Card>
            ) : null}
            <OpenShiftPanel siteId={site.id} siteName={site.name} />
          </div>
        ) : (
          <>
            <section aria-labelledby="pos-catalogo" className="min-w-0">
              <Card className="flex h-full flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="text-caption font-semibold tracking-[0.12em] text-ink-3 uppercase">
                      Punto de venta
                    </p>
                    <h1 id="pos-catalogo" className="mt-1 font-display text-title font-bold text-ink">
                      Productos
                    </h1>
                    <p className="mt-1 text-body text-ink-2">
                      Toca un producto para agregarlo al ticket. Los platos descuentan consumo teórico; los
                      fabricados salen por FEFO.
                    </p>
                  </div>
                  <Badge tone="info">Turno abierto</Badge>
                </div>

                {catalog.data.items.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={<ShoppingBag className="size-5" />}
                      title="No hay productos vendibles"
                      description="Revisa precios, recetas y existencia en Productos del punto."
                    />
                  </div>
                ) : (
                  <ul className="mt-4 grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {catalog.data.items.map((item) => (
                      <li key={item.presentationId}>
                        <button
                          type="button"
                          disabled={!item.sellable}
                          onClick={() => {
                            add(item);
                          }}
                          className="flex min-h-28 w-full flex-col rounded-2xl border border-line bg-surface-2/40 p-4 text-left transition-colors hover:border-brand/50 hover:bg-surface-2 focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-body font-semibold text-ink">
                                {item.productName}
                              </span>
                              <span className="block truncate text-caption text-ink-2">
                                {item.presentationName}
                              </span>
                            </span>
                            {item.kind === 'prepared' ? <Badge tone="info">Plato</Badge> : null}
                          </span>
                          <span className="mt-auto flex items-end justify-between gap-2 pt-3">
                            <span className="font-mono text-title font-bold text-ink">
                              {formatMoney(item.price)}
                            </span>
                            <span className="text-caption text-ink-2">
                              {item.available === null
                                ? 'Consumo teórico'
                                : `${formatQuantity(item.available)} disp.`}
                            </span>
                          </span>
                          {item.reason ? (
                            <span className="mt-1 text-caption text-warning">{item.reason}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>

            <aside aria-labelledby="pos-ticket" className="min-w-0 md:sticky md:top-[88px] md:self-start">
              <Card className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                  <h2 id="pos-ticket" className="font-display text-title font-bold text-ink">
                    Venta actual
                  </h2>
                  <Badge tone={ticket.length > 0 ? 'info' : 'neutral'}>
                    {ticket.length} {ticket.length === 1 ? 'línea' : 'líneas'}
                  </Badge>
                </div>

                {ticket.length === 0 ? (
                  <div className="mt-4 flex-1">
                    <EmptyState
                      compact
                      icon={<ShoppingBag className="size-5" />}
                      title="Sin productos en la venta"
                      description="El ticket se llena al tocar productos del catálogo."
                    />
                  </div>
                ) : (
                  <ul className="mt-4 flex-1 divide-y divide-line">
                    {ticket.map((line) => (
                      <li key={line.item.presentationId} className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-body font-semibold text-ink">
                              {line.item.productName}
                            </p>
                            <p className="text-caption text-ink-2">
                              {line.item.presentationName} · {formatMoney(line.item.price)}
                            </p>
                          </div>
                          <p className="shrink-0 font-mono text-body text-ink">
                            {formatMoney(Number(line.item.price) * line.quantity)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <Button
                            variant="ghost"
                            aria-label={`Quitar uno de ${line.item.productName}`}
                            onClick={() => {
                              changeQuantity(line.item.presentationId, -1);
                            }}
                          >
                            <Minus aria-hidden className="size-4" />
                          </Button>
                          <span className="min-w-8 text-center font-mono text-body text-ink">
                            {formatQuantity(line.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            aria-label={`Agregar uno de ${line.item.productName}`}
                            onClick={() => {
                              changeQuantity(line.item.presentationId, 1);
                            }}
                          >
                            <Plus aria-hidden className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Quitar ${line.item.productName} del ticket`}
                            onClick={() => {
                              setTicket((current) =>
                                current.filter(
                                  (item) => item.item.presentationId !== line.item.presentationId,
                                ),
                              );
                            }}
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <dl className="mt-4 space-y-2.5 border-t border-line pt-4">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-body text-ink-2">Total a pagar</dt>
                    <dd className="font-mono text-[1.75rem] leading-8 font-bold text-ink">
                      {formatMoney(total)}
                    </dd>
                  </div>
                </dl>

                {createSale.error ? <Alert tone="error">{createSale.error.message}</Alert> : null}
                <Button
                  className="mt-4 w-full"
                  disabled={ticket.length === 0 || methods.length === 0}
                  onClick={() => {
                    setPaymentOpen(true);
                  }}
                >
                  <CreditCard aria-hidden className="size-5" />
                  Cobrar {formatMoney(total)}
                </Button>
                <p className="mt-2 text-center text-caption text-ink-3">
                  Comprobante interno; no es factura (P-02).
                </p>
              </Card>
            </aside>
          </>
        )}
      </main>

      {shift.data && paymentOpen ? (
        <PaymentDialog
          open={paymentOpen}
          total={total}
          methods={methods}
          busy={createSale.isPending}
          error={createSale.error?.message ?? null}
          onClose={() => {
            setPaymentOpen(false);
          }}
          onConfirm={confirmSale}
        />
      ) : null}

      {closingShiftId && closeOpen ? (
        <CloseShiftDialog
          open={closeOpen}
          shiftId={closingShiftId}
          methods={methods}
          onClose={() => {
            setCloseOpen(false);
            setClosingShiftId(null);
          }}
          onClosed={(closed) => {
            setClosedShift(closed);
          }}
        />
      ) : null}

      <PosDialog
        open={collectOpen}
        title="Cobrar cartera"
        description="Registra un abono de un cliente. Se aplica a la obligación más antigua o a las que selecciones."
        onClose={() => {
          setCollectOpen(false);
        }}
        wide
      >
        <PaymentForm
          me={me}
          siteId={site.id}
          onDone={() => {
            setCollectOpen(false);
          }}
        />
      </PosDialog>

      <PosDialog
        open={Boolean(receipt)}
        title="Venta registrada"
        description="Revisa el comprobante interno antes de continuar."
        onClose={() => {
          setReceipt(null);
        }}
        footer={
          <Button
            onClick={() => {
              setReceipt(null);
            }}
          >
            Nueva venta
          </Button>
        }
      >
        {receipt ? <SaleReceipt sale={receipt} /> : null}
      </PosDialog>
    </div>
  );
}
