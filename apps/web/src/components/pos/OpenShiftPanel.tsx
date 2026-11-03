import { Wallet } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { formatMoney, toAmount } from '../../lib/format/pos';
import { newIdempotencyKey } from '../../services/client';
import { useOpenShift } from '../../services/pos';
import { Card, CardLabel } from '../ui/Card';
import { Alert, Button, TextField } from '../ui/form';

/** Apertura de turno: la base de efectivo es lo primero que ve el cajero. */
export function OpenShiftPanel({ siteId, siteName }: { siteId: string; siteName: string }) {
  const open = useOpenShift();
  const [openingCash, setOpeningCash] = useState('0.00');
  const [idempotencyKey] = useState(newIdempotencyKey);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    open.mutate({
      input: { siteId, openingCash: toAmount(openingCash) },
      idempotencyKey,
    });
  };

  return (
    <Card className="mx-auto w-full max-w-xl">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-ink"
        >
          <Wallet className="size-6" />
        </span>
        <div>
          <CardLabel>Apertura de turno</CardLabel>
          <h1 className="mt-1 font-display text-title font-bold text-ink">Abrir caja</h1>
          <p className="mt-1 text-body text-ink-2">
            Caja en <span className="font-semibold text-ink">{siteName}</span>. Registra la base de efectivo
            con la que empiezas.
          </p>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={submit}>
        <TextField
          label="Base de efectivo"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={openingCash}
          hint={`Se registrará como ${formatMoney(toAmount(openingCash))}.`}
          onChange={(event) => {
            setOpeningCash(event.target.value);
          }}
        />
        {open.error ? <Alert tone="error">{open.error.message}</Alert> : null}
        <Button type="submit" className="w-full" disabled={open.isPending}>
          {open.isPending ? 'Abriendo turno…' : 'Abrir turno'}
        </Button>
      </form>
    </Card>
  );
}
