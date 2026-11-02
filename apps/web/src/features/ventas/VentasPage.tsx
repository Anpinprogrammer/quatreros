import {
  CUSTOMER_KIND_LABELS,
  DISPATCH_STATUS_LABELS,
  PAYMENT_MODE_LABELS,
  SALES_CHANNEL_LABELS,
  SALES_ORDER_STATUS_LABELS,
  type CustomerKind,
  type CustomerView,
  type MeResponse,
  type PaymentMode,
  type SalesChannel,
  type SalesOrderStatus,
} from '@quatreros/contracts';
import { Building2, ClipboardList, Plus, Trash2, Truck } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { newIdempotencyKey, type ApiError } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { DataTable } from '../../shared/ui/DataTable';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FilterBar } from '../../shared/ui/FilterBar';
import { Alert, Button, SelectField, TextField } from '../../shared/ui/form';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { SearchInput } from '../../shared/ui/SearchInput';
import { useToast } from '../../shared/ui/Toast';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useProducts } from '../catalogo/api';
import {
  useCreateCustomer,
  useCreateDispatch,
  useCreateOrder,
  useCustomers,
  useDispatches,
  useDrivers,
  useOrders,
  useUpdateCredit,
  useUpdateCustomer,
} from './api';
import { formatDate, formatMoney, formatQuantity } from './format';

type Tab = 'customers' | 'orders' | 'dispatches';

const orderTones: Record<SalesOrderStatus, BadgeTone> = {
  confirmed: 'info',
  in_dispatch: 'warning',
  partially_delivered: 'warning',
  delivered: 'success',
};
const dispatchTones: Record<keyof typeof DISPATCH_STATUS_LABELS, BadgeTone> = {
  prepared: 'info',
  in_route: 'warning',
  to_settle: 'success',
};

export function VentasPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Clientes, pedidos y despachos');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = requestedTab === 'orders' || requestedTab === 'dispatches' ? requestedTab : 'customers';
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'customers') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };
  const tabs: { id: Tab; label: string }[] = [
    { id: 'customers', label: 'Clientes' },
    { id: 'orders', label: 'Pedidos' },
    { id: 'dispatches', label: 'Despachos' },
  ];

  return (
    <section aria-labelledby="ventas-titulo" className="space-y-7">
      <PageHeader
        titleId="ventas-titulo"
        eyebrow={
          <Link to="/erp/seccion/reparto" className="hover:text-ink">
            Distribución
          </Link>
        }
        title="Clientes, pedidos y despachos"
        description="Pedido confirmado con precio y reserva, despacho FEFO y entrega desde el celular del repartidor."
      />
      <div
        role="tablist"
        aria-label="Ventas y reparto"
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              id={`ventas-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`ventas-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={`-mb-px min-h-12 shrink-0 rounded-t-lg border-b-2 px-4 text-body font-semibold ${selected ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
              onClick={() => {
                setTab(item.id);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="ventas-panel-customers"
        aria-labelledby="ventas-tab-customers"
        hidden={tab !== 'customers'}
      >
        {tab === 'customers' ? <CustomersPanel me={me} /> : null}
      </div>
      <div
        role="tabpanel"
        id="ventas-panel-orders"
        aria-labelledby="ventas-tab-orders"
        hidden={tab !== 'orders'}
      >
        {tab === 'orders' ? <OrdersPanel me={me} /> : null}
      </div>
      <div
        role="tabpanel"
        id="ventas-panel-dispatches"
        aria-labelledby="ventas-tab-dispatches"
        hidden={tab !== 'dispatches'}
      >
        {tab === 'dispatches' ? <DispatchesPanel me={me} /> : null}
      </div>
    </section>
  );
}

function CustomersPanel({ me }: { me: MeResponse }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<CustomerView | 'new' | null>(null);
  const [credit, setCredit] = useState<CustomerView | null>(null);
  const customers = useCustomers({ q, status: 'active' });
  const toast = useToast();
  const canManage = hasPermission(me, 'com.customer.manage');
  const canCredit = hasPermission(me, 'fin.credit.configure');

  return (
    <section className="space-y-5" aria-labelledby="clientes-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="clientes-titulo" className="font-display text-title font-bold text-ink">
            Clientes
          </h2>
          <p className="mt-1 text-body text-ink-2">Datos de entrega y crédito cuando aplique.</p>
        </div>
        {canManage && editing === null ? (
          <Button
            onClick={() => {
              setEditing('new');
            }}
          >
            Nuevo cliente
          </Button>
        ) : null}
      </div>
      {editing ? (
        <CustomerForm
          {...(editing === 'new' ? {} : { customer: editing })}
          onDone={(message) => {
            setEditing(null);
            toast.show(message);
          }}
          onCancel={() => {
            setEditing(null);
          }}
        />
      ) : null}
      {credit ? (
        <CreditForm
          customer={credit}
          onDone={() => {
            setCredit(null);
            toast.show('Crédito actualizado.');
          }}
          onCancel={() => {
            setCredit(null);
          }}
        />
      ) : null}
      <FilterBar>
        <SearchInput
          label="Buscar cliente"
          placeholder="Nombre"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
      </FilterBar>
      {customers.isPending ? <LoadingSkeleton label="Cargando clientes…" rows={2} /> : null}
      {customers.error ? <Alert>{customers.error.message}</Alert> : null}
      {customers.data?.data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Sin clientes"
          description="Crea el primero para registrar pedidos."
        />
      ) : null}
      {customers.data && customers.data.data.length > 0 ? (
        <DataTable minWidth="56rem" label="Clientes">
          <caption className="sr-only">Clientes activos</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Cliente
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Tipo
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Contacto
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Crédito
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.data.data.map((customer) => (
              <tr key={customer.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <span className="block font-semibold text-ink">{customer.name}</span>
                  <span className="text-caption text-ink-2">{customer.deliveryAddress ?? '—'}</span>
                </td>
                <td className="px-3 py-3 text-ink-2">{CUSTOMER_KIND_LABELS[customer.kind]}</td>
                <td className="px-3 py-3 text-ink-2">{customer.phone ?? '—'}</td>
                <td className="px-3 py-3 text-ink-2">
                  {customer.credit?.enabled
                    ? `${formatMoney(customer.credit.creditLimit)} · ${String(customer.credit.termDays)} días`
                    : 'Contraentrega'}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {canManage ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(customer);
                        }}
                      >
                        Editar
                      </Button>
                    ) : null}
                    {canCredit ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setCredit(customer);
                        }}
                      >
                        Crédito
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}

function CustomerForm({
  customer,
  onDone,
  onCancel,
}: {
  customer?: CustomerView;
  onDone: (m: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const [key] = useState(newIdempotencyKey);
  const [kind, setKind] = useState(customer?.kind ?? 'restaurant');
  const [name, setName] = useState(customer?.name ?? '');
  const [taxId, setTaxId] = useState(customer?.taxId ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.deliveryAddress ?? '');
  const error = (create.error ?? update.error) as ApiError | null;
  const busy = create.isPending || update.isPending;
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      kind,
      name,
      taxId: taxId.trim() || null,
      phone: phone.trim() || null,
      deliveryAddress: address.trim() || null,
    };
    if (customer)
      update.mutate(
        { id: customer.id, version: customer.version, input },
        {
          onSuccess: () => {
            onDone(`Cliente ${name} actualizado.`);
          },
        },
      );
    else
      create.mutate(
        { input, idempotencyKey: key },
        {
          onSuccess: () => {
            onDone(`Cliente ${name} creado.`);
          },
        },
      );
  };
  return (
    <form
      className="flex max-w-3xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label={customer ? `Editar ${customer.name}` : 'Nuevo cliente'}
    >
      <h3 className="font-display text-title font-bold text-ink">
        {customer ? `Editar ${customer.name}` : 'Nuevo cliente'}
      </h3>
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          options={Object.entries(CUSTOMER_KIND_LABELS).map(([value, label]) => ({ value, label }))}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as CustomerKind);
          }}
        />
        <TextField
          label="Nombre"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <TextField
          label="Identificación (NIT)"
          value={taxId}
          onChange={(e) => {
            setTaxId(e.target.value);
          }}
        />
        <TextField
          label="Teléfono"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
          }}
        />
      </div>
      <TextField
        label="Dirección de entrega"
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
        }}
      />
      <div className="flex gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : customer ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function CreditForm({
  customer,
  onDone,
  onCancel,
}: {
  customer: CustomerView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const update = useUpdateCredit();
  const [enabled, setEnabled] = useState(customer.credit?.enabled ?? false);
  const [limit, setLimit] = useState(customer.credit?.creditLimit ?? '0');
  const [termDays, setTermDays] = useState(String(customer.credit?.termDays ?? 0));
  const error = update.error as ApiError | null;
  return (
    <form
      className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(
          { id: customer.id, input: { enabled, creditLimit: limit, termDays: Number(termDays) } },
          { onSuccess: onDone },
        );
      }}
      aria-label={`Crédito de ${customer.name}`}
    >
      <h3 className="font-display text-title font-bold text-ink">Crédito · {customer.name}</h3>
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Crédito"
          options={[
            { value: 'false', label: 'Deshabilitado' },
            { value: 'true', label: 'Habilitado' },
          ]}
          value={String(enabled)}
          onChange={(e) => {
            setEnabled(e.target.value === 'true');
          }}
        />
        <TextField
          label="Cupo"
          type="number"
          min={0}
          step={0.01}
          value={limit}
          onChange={(e) => {
            setLimit(e.target.value);
          }}
        />
        <TextField
          label="Plazo (días)"
          type="number"
          min={0}
          value={termDays}
          onChange={(e) => {
            setTermDays(e.target.value);
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={update.isPending}>
          Guardar crédito
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function OrdersPanel({ me }: { me: MeResponse }) {
  const [status, setStatus] = useState<'' | SalesOrderStatus>('');
  const [creating, setCreating] = useState(false);
  const orders = useOrders({ status: status || undefined, limit: 100 });
  const navigate = useNavigate();
  const canCreate = hasPermission(me, 'com.order.create');
  return (
    <section className="space-y-5" aria-labelledby="pedidos-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pedidos-titulo" className="font-display text-title font-bold text-ink">
            Pedidos
          </h2>
          <p className="mt-1 text-body text-ink-2">
            El pedido confirmado congela precio y reserva inventario.
          </p>
        </div>
        {canCreate && !creating ? (
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus className="size-4" aria-hidden /> Nuevo pedido
          </Button>
        ) : null}
      </div>
      {creating ? (
        <OrderForm
          me={me}
          onDone={(id) => {
            setCreating(false);
            void navigate(`/erp/ventas/pedidos/${id}`);
          }}
          onCancel={() => {
            setCreating(false);
          }}
        />
      ) : null}
      <FilterBar>
        <SelectField
          label="Estado"
          options={[
            { value: '', label: 'Todos' },
            ...Object.entries(SALES_ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | SalesOrderStatus);
          }}
        />
      </FilterBar>
      {orders.isPending ? <LoadingSkeleton label="Cargando pedidos…" rows={2} /> : null}
      {orders.error ? <Alert>{orders.error.message}</Alert> : null}
      {orders.data?.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="Sin pedidos"
          description="Crea el primero para reservar y despachar."
        />
      ) : null}
      {orders.data && orders.data.data.length > 0 ? (
        <DataTable minWidth="64rem" label="Pedidos">
          <caption className="sr-only">Pedidos por cliente, sede, estado y total</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Pedido
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Cliente
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Sede
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Pago
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Total
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.data.data.map((order) => (
              <tr key={order.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link
                    className="font-mono text-brand-ink hover:text-ink"
                    to={`/erp/ventas/pedidos/${order.id}`}
                  >
                    {order.number}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  {order.customerName}
                  {order.creditWarning ? (
                    <span className="block text-caption text-warning">Con advertencia de crédito</span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-ink-2">{order.siteName}</td>
                <td className="px-3 py-3 text-ink-2">{PAYMENT_MODE_LABELS[order.paymentMode]}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{formatMoney(order.total)}</td>
                <td className="px-3 py-3">
                  <Badge tone={orderTones[order.status]}>{SALES_ORDER_STATUS_LABELS[order.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}

function OrderForm({
  me,
  onDone,
  onCancel,
}: {
  me: MeResponse;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const customers = useCustomers({ status: 'active' });
  const products = useProducts({ status: 'active' });
  const create = useCreateOrder();
  const [key] = useState(newIdempotencyKey);
  const [customerId, setCustomerId] = useState('');
  const [siteId, setSiteId] = useState(me.sites[0]?.id ?? '');
  const [channel, setChannel] = useState<SalesChannel>('whatsapp');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash_on_delivery');
  const [requestedDate, setRequestedDate] = useState('');
  const [lines, setLines] = useState([{ presentationId: '', quantity: '' }]);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = create.error as ApiError | null;
  const presentations = (products.data?.data ?? []).flatMap((product) =>
    product.presentations
      .filter((p) => p.isActive)
      .map((presentation) => ({ value: presentation.id, label: `${product.name} · ${presentation.name}` })),
  );
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (!customerId || !siteId) {
      setLocalError('Selecciona cliente y sede.');
      return;
    }
    for (const line of lines)
      if (
        !line.presentationId ||
        !/^\d{1,11}(\.\d{1,3})?$/.test(line.quantity) ||
        Number(line.quantity) <= 0
      ) {
        setLocalError('Completa presentación y cantidad mayor que 0.');
        return;
      }
    create.mutate(
      {
        input: {
          customerId,
          siteId,
          channel,
          paymentMode,
          ...(requestedDate ? { requestedDate } : {}),
          lines,
        },
        idempotencyKey: key,
      },
      {
        onSuccess: (res) => {
          onDone(res.data.id);
        },
      },
    );
  };
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label="Nuevo pedido"
    >
      <h3 className="font-display text-title font-bold text-ink">Nuevo pedido</h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <SelectField
          label="Cliente"
          options={[
            { value: '', label: 'Selecciona el cliente' },
            ...(customers.data?.data ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
          }}
        />
        <SelectField
          label="Sede"
          options={me.sites.map((s) => ({ value: s.id, label: s.name }))}
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
          }}
        />
        <SelectField
          label="Canal"
          options={Object.entries(SALES_CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as SalesChannel);
          }}
        />
        <SelectField
          label="Pago"
          options={Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          value={paymentMode}
          onChange={(e) => {
            setPaymentMode(e.target.value as PaymentMode);
          }}
        />
        <TextField
          label="Fecha deseada"
          type="date"
          value={requestedDate}
          onChange={(e) => {
            setRequestedDate(e.target.value);
          }}
        />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <h4 className="text-body font-semibold text-ink">Líneas</h4>
          <Button
            variant="secondary"
            onClick={() => {
              setLines((c) => [...c, { presentationId: '', quantity: '' }]);
            }}
          >
            <Plus className="size-4" aria-hidden /> Agregar
          </Button>
        </div>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
          >
            <SelectField
              label={`Presentación ${String(index + 1)}`}
              options={[{ value: '', label: 'Selecciona' }, ...presentations]}
              value={line.presentationId}
              onChange={(e) => {
                setLines((c) =>
                  c.map((item, i) => (i === index ? { ...item, presentationId: e.target.value } : item)),
                );
              }}
            />
            <TextField
              label="Cantidad"
              type="number"
              min={0.001}
              step={0.001}
              value={line.quantity}
              onChange={(e) => {
                setLines((c) =>
                  c.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)),
                );
              }}
            />
            <div className="flex items-end">
              <Button
                variant="ghost"
                aria-label={`Quitar línea ${String(index + 1)}`}
                disabled={lines.length === 1}
                onClick={() => {
                  setLines((c) => c.filter((_, i) => i !== index));
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Confirmando…' : 'Confirmar pedido'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <p className="text-caption text-ink-2">
        Si no hay existencia suficiente, el pedido se confirma con faltante. Un pedido a crédito con cupo
        excedido o mora se confirma con advertencia.
      </p>
    </form>
  );
}

function DispatchesPanel({ me }: { me: MeResponse }) {
  const [creating, setCreating] = useState(false);
  const dispatches = useDispatches({ limit: 100 });
  const canCreate = hasPermission(me, 'dis.dispatch.create');
  const navigate = useNavigate();
  return (
    <section className="space-y-5" aria-labelledby="despachos-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="despachos-titulo" className="font-display text-title font-bold text-ink">
            Despachos
          </h2>
          <p className="mt-1 text-body text-ink-2">Pedidos confirmados que salen con un distribuidor.</p>
        </div>
        {canCreate && !creating ? (
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Truck className="size-4" aria-hidden /> Nuevo despacho
          </Button>
        ) : null}
      </div>
      {creating ? (
        <DispatchForm
          me={me}
          onDone={(id) => {
            setCreating(false);
            void navigate(`/erp/ventas/despachos/${id}`);
          }}
          onCancel={() => {
            setCreating(false);
          }}
        />
      ) : null}
      {dispatches.isPending ? <LoadingSkeleton label="Cargando despachos…" rows={2} /> : null}
      {dispatches.error ? <Alert>{dispatches.error.message}</Alert> : null}
      {dispatches.data?.data.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-5" />}
          title="Sin despachos"
          description="Crea uno con pedidos confirmados."
        />
      ) : null}
      {dispatches.data && dispatches.data.data.length > 0 ? (
        <DataTable minWidth="56rem" label="Despachos">
          <caption className="sr-only">Despachos por distribuidor, fecha y estado</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Despacho
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Distribuidor
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Fecha
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Estado
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Cargado
              </th>
            </tr>
          </thead>
          <tbody>
            {dispatches.data.data.map((dispatch) => (
              <tr key={dispatch.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link
                    className="font-mono text-brand-ink hover:text-ink"
                    to={`/erp/ventas/despachos/${dispatch.id}`}
                  >
                    {dispatch.number}
                  </Link>
                </td>
                <td className="px-3 py-3">{dispatch.driverName}</td>
                <td className="px-3 py-3 text-ink-2">{formatDate(dispatch.dispatchDate)}</td>
                <td className="px-3 py-3">
                  <Badge tone={dispatchTones[dispatch.status]}>
                    {DISPATCH_STATUS_LABELS[dispatch.status]}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatQuantity(dispatch.loadedTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}

function DispatchForm({
  me,
  onDone,
  onCancel,
}: {
  me: MeResponse;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const drivers = useDrivers();
  const orders = useOrders({ status: 'confirmed', limit: 100 });
  const create = useCreateDispatch();
  const [key] = useState(newIdempotencyKey);
  const [siteId, setSiteId] = useState(me.sites[0]?.id ?? '');
  const [driverId, setDriverId] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = create.error as ApiError | null;
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        setLocalError(null);
        if (!driverId || orderIds.length === 0) {
          setLocalError('Selecciona distribuidor y al menos un pedido.');
          return;
        }
        create.mutate(
          { input: { siteId, driverId, dispatchDate, orderIds }, idempotencyKey: key },
          {
            onSuccess: (res) => {
              onDone(res.data.id);
            },
          },
        );
      }}
      aria-label="Nuevo despacho"
    >
      <h3 className="font-display text-title font-bold text-ink">Nuevo despacho</h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          label="Sede"
          options={me.sites.map((s) => ({ value: s.id, label: s.name }))}
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
          }}
        />
        <SelectField
          label="Distribuidor"
          options={[
            { value: '', label: 'Selecciona' },
            ...(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName })),
          ]}
          value={driverId}
          onChange={(e) => {
            setDriverId(e.target.value);
          }}
        />
        <TextField
          label="Fecha"
          type="date"
          value={dispatchDate}
          onChange={(e) => {
            setDispatchDate(e.target.value);
          }}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-body font-semibold text-ink">Pedidos confirmados</legend>
        {orders.data?.data.length === 0 ? (
          <p className="text-body text-ink-2">No hay pedidos confirmados.</p>
        ) : null}
        {(orders.data?.data ?? []).map((order) => (
          <label
            key={order.id}
            className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-body"
          >
            <input
              type="checkbox"
              checked={orderIds.includes(order.id)}
              onChange={(e) => {
                setOrderIds((current) =>
                  e.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id),
                );
              }}
            />
            <span className="font-mono">{order.number}</span>
            <span>{order.customerName}</span>
            <span className="ml-auto font-mono">{formatMoney(order.total)}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={create.isPending}>
          Crear despacho
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
