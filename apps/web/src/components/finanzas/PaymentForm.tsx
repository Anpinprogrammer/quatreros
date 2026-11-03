import type { CollectionDetail, MeResponse } from '@quatreros/contracts';
import { useState, type SubmitEvent } from 'react';
import { Card, CardLabel } from '../ui/Card';
import { Alert, Button, CheckboxField, SelectField, TextField } from '../ui/form';
import { formatMoney } from '../../lib/format/pos';
import { newIdempotencyKey } from '../../services/client';
import { useCustomers } from '../../services/ventas';
import { useCreatePayment, useCustomerBalance, usePaymentMethods } from '../../services/finance';

/** Abono de cartera: FIFO por defecto o asignación manual a obligaciones. */
export function PaymentForm({
  me,
  siteId,
  initialCustomerId,
  onDone,
}: {
  me: MeResponse;
  siteId?: string | undefined;
  initialCustomerId?: string | undefined;
  onDone?: (() => void) | undefined;
}) {
  const customers = useCustomers({ status: 'active' });
  const methods = usePaymentMethods();
  const create = useCreatePayment();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  const [site, setSite] = useState(siteId ?? me.sites[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [manual, setManual] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [receipt, setReceipt] = useState<CollectionDetail | null>(null);
  const balance = useCustomerBalance(manual ? customerId : '');
  const busy = create.isPending;
  const methodOptions = (methods.data ?? []).map((method) => ({
    value: method.id,
    label: method.name,
  }));
  const selectedMethod = methodOptions.some((option) => option.value === methodId)
    ? methodId
    : (methodOptions[0]?.value ?? '');

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerId || !site || !selectedMethod) return;
    const manualAllocations = manual
      ? Object.entries(allocations)
          .filter(([, value]) => Number(value) > 0)
          .map(([receivableId, value]) => ({ receivableId, amount: Number(value).toFixed(2) }))
      : undefined;
    create.mutate(
      {
        input: {
          customerId,
          siteId: site,
          paymentMethodId: selectedMethod,
          amount: Number(amount).toFixed(2),
          ...(manualAllocations ? { allocations: manualAllocations } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        idempotencyKey,
      },
      {
        onSuccess: (res) => {
          setReceipt(res.data);
        },
      },
    );
  };

  if (receipt) {
    return (
      <Card>
        <CardLabel>Abono registrado</CardLabel>
        <p className="mt-1 font-mono text-title font-bold text-ink">{receipt.number}</p>
        <p className="mt-1 text-body text-ink-2">
          {receipt.customerName} · {receipt.paymentMethodName} · {formatMoney(receipt.amount)}
        </p>
        <p className="mt-2 text-caption text-ink-2">
          Aplicado: {formatMoney(receipt.allocatedAmount)} en {receipt.allocations.length}{' '}
          {receipt.allocations.length === 1 ? 'obligación' : 'obligaciones'}.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => {
              setReceipt(null);
              setAmount('');
              setNote('');
              setAllocations({});
              setIdempotencyKey(newIdempotencyKey());
              onDone?.();
            }}
          >
            Listo
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setReceipt(null);
              setAmount('');
              setNote('');
              setAllocations({});
              setIdempotencyKey(newIdempotencyKey());
            }}
          >
            Registrar otro
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Cliente"
          options={[
            { value: '', label: 'Selecciona un cliente' },
            ...(customers.data?.data ?? []).map((customer) => ({
              value: customer.id,
              label: customer.name,
            })),
          ]}
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setAllocations({});
          }}
        />
        <SelectField
          label="Sede del recaudo"
          options={me.sites.map((item) => ({ value: item.id, label: item.name }))}
          value={site}
          disabled={Boolean(siteId)}
          onChange={(event) => {
            setSite(event.target.value);
          }}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Monto"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
          }}
        />
        <SelectField
          label="Método de pago"
          options={methodOptions.length > 0 ? methodOptions : [{ value: '', label: 'Sin medios activos' }]}
          value={selectedMethod}
          onChange={(event) => {
            setMethodId(event.target.value);
          }}
        />
      </div>
      <TextField
        label="Nota"
        value={note}
        hint="Opcional; queda en la auditoría y el comprobante."
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />

      <CheckboxField
        label="Aplicar manualmente"
        checked={manual}
        hint="Si lo desactivas, el abono se aplica a la obligación más antigua."
        onChange={(checked) => {
          setManual(checked);
          setAllocations({});
        }}
      />

      {manual && customerId ? (
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <CardLabel as="p">Obligaciones abiertas</CardLabel>
            <span className="text-caption text-ink-2">
              Total {balance.data ? formatMoney(balance.data.total) : '—'}
            </span>
          </div>
          {balance.isPending ? <p className="mt-2 text-caption text-ink-2">Consultando…</p> : null}
          {balance.data?.receivables.length === 0 ? (
            <p className="mt-2 text-caption text-ink-2">El cliente no tiene obligaciones abiertas.</p>
          ) : null}
          <ul className="mt-3 space-y-3">
            {balance.data?.receivables.map((receivable) => (
              <li key={receivable.id} className="grid gap-2 sm:grid-cols-[1fr_9rem] sm:items-end">
                <div>
                  <p className="text-body font-semibold text-ink">
                    {receivable.sourceType} · vence {receivable.dueOn}
                  </p>
                  <p className="text-caption text-ink-2">Saldo {formatMoney(receivable.balance)}</p>
                </div>
                <TextField
                  label="Aplicar"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={allocations[receivable.id] ?? ''}
                  onChange={(event) => {
                    setAllocations((current) => ({
                      ...current,
                      [receivable.id]: event.target.value,
                    }));
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}
      <Button type="submit" disabled={busy || !customerId || !site || !selectedMethod}>
        {busy ? 'Registrando…' : 'Registrar abono'}
      </Button>
    </form>
  );
}
