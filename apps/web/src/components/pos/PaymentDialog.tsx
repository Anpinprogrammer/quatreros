import { useState } from 'react';
import type { PaymentMethodView } from '@quatreros/contracts';
import { formatMoney, toAmount } from '../../lib/format/pos';
import { Alert, Button, TextField } from '../ui/form';
import { PosDialog } from './PosDialog';

/** Pago mixto: el servidor vuelve a validar la suma y el cambio; aquí solo se anticipa. */
export function PaymentDialog({
  open,
  total,
  methods,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  total: number;
  methods: PaymentMethodView[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (payments: { paymentMethodId: string; amount: string }[]) => void;
}) {
  const cashMethod = methods.find((method) => method.isCash);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    cashMethod ? { [cashMethod.id]: toAmount(total) } : {},
  );

  const paid = methods.reduce((sum, method) => sum + Number(amounts[method.id] ?? '0'), 0);
  const cash = methods
    .filter((method) => method.isCash)
    .reduce((sum, method) => sum + Number(amounts[method.id] ?? '0'), 0);
  const change = Math.max(paid - total, 0);
  const below = paid + 0.001 < total;
  const changeNotCash = change > cash + 0.001;
  const canConfirm = !busy && !below && !changeNotCash && paid > 0;

  return (
    <PosDialog
      open={open}
      title="Cobrar venta"
      description={`Total a pagar: ${formatMoney(total)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={() => {
              const payments = methods
                .map((method) => ({ paymentMethodId: method.id, amount: amounts[method.id] ?? '' }))
                .filter((payment) => Number(payment.amount) > 0)
                .map((payment) => ({ ...payment, amount: toAmount(payment.amount) }));
              onConfirm(payments);
            }}
          >
            {busy ? 'Registrando…' : 'Confirmar venta'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {methods.map((method) => (
          <TextField
            key={method.id}
            label={method.name}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amounts[method.id] ?? ''}
            hint={method.isCash ? 'El cambio se calcula sobre el efectivo.' : 'Pago exacto o parcial.'}
            onChange={(event) => {
              setAmounts((current) => ({ ...current, [method.id]: event.target.value }));
            }}
          />
        ))}

        <dl className="space-y-2 rounded-xl border border-line bg-surface-2/50 p-4">
          <div className="flex items-baseline justify-between">
            <dt className="text-body text-ink-2">Pagado</dt>
            <dd className="font-mono text-body text-ink">{formatMoney(paid)}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-body text-ink-2">Cambio</dt>
            <dd className="font-mono text-title font-bold text-ink">{formatMoney(change)}</dd>
          </div>
        </dl>

        {below ? <Alert tone="info">La suma de los pagos es menor que el total.</Alert> : null}
        {changeNotCash ? (
          <Alert tone="info">El cambio debe cubrirse con efectivo; revisa los montos.</Alert>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
    </PosDialog>
  );
}
