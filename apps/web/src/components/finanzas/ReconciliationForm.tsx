import type { CollectionView } from '@quatreros/contracts';
import { COLLECTOR_TYPE_LABELS } from '@quatreros/contracts';
import { useState, type SubmitEvent } from 'react';
import { Card, CardLabel } from '../ui/Card';
import { Alert, Button, CheckboxField, TextField } from '../ui/form';
import { formatMoney } from '../../lib/format/pos';
import { newIdempotencyKey } from '../../services/client';
import { useCreateReconciliation } from '../../services/finance';

/** Concilia un grupo de recaudos del mismo responsable y sede. */
export function ReconciliationForm({
  collections,
  onDone,
}: {
  collections: CollectionView[];
  onDone?: (() => void) | undefined;
}) {
  const create = useCreateReconciliation();
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(collections.map((collection) => [collection.id, true])),
  );
  const [received, setReceived] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [done, setDone] = useState(false);

  const chosen = collections.filter((collection) => selected[collection.id]);
  const expectedByMethod = new Map<string, { name: string; amount: number }>();
  for (const collection of chosen) {
    const current = expectedByMethod.get(collection.paymentMethodId) ?? {
      name: collection.paymentMethodName,
      amount: 0,
    };
    current.amount += Number(collection.amount);
    expectedByMethod.set(collection.paymentMethodId, current);
  }
  const first = collections[0];

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!first || chosen.length === 0) return;
    create.mutate(
      {
        input: {
          siteId: first.siteId,
          collectorType: first.collectorType,
          ...(first.collectorUserId ? { collectorUserId: first.collectorUserId } : {}),
          collectionIds: chosen.map((collection) => collection.id),
          counts: [...expectedByMethod.entries()].map(([paymentMethodId, expected]) => ({
            paymentMethodId,
            receivedAmount: Number(received[paymentMethodId] ?? expected.amount.toFixed(2)).toFixed(2),
          })),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        idempotencyKey,
      },
      {
        onSuccess: () => {
          setDone(true);
          onDone?.();
        },
      },
    );
  };

  if (done) {
    return <Alert tone="success">Conciliación registrada. La lista se actualizará.</Alert>;
  }

  return (
    <Card>
      <CardLabel>{COLLECTOR_TYPE_LABELS[first?.collectorType ?? 'office']}</CardLabel>
      <p className="mt-1 font-display text-title font-bold text-ink">
        {first?.collectorName ?? 'Sin responsable'}
      </p>
      <p className="text-caption text-ink-2">{first?.siteName}</p>

      <form className="mt-4 space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          {collections.map((collection) => (
            <CheckboxField
              key={collection.id}
              label={`${collection.number} · ${collection.customerName ?? 'Sin cliente'} · ${formatMoney(collection.amount)}`}
              checked={selected[collection.id] ?? false}
              onChange={(checked) => {
                setSelected((current) => ({ ...current, [collection.id]: checked }));
              }}
            />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[...expectedByMethod.entries()].map(([paymentMethodId, expected]) => (
            <TextField
              key={paymentMethodId}
              label={`${expected.name} recibido`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={received[paymentMethodId] ?? expected.amount.toFixed(2)}
              hint={`Esperado ${formatMoney(expected.amount)}`}
              onChange={(event) => {
                setReceived((current) => ({ ...current, [paymentMethodId]: event.target.value }));
              }}
            />
          ))}
        </div>

        <TextField
          label="Nota de la conciliación"
          value={note}
          hint="Obligatoria si hay una diferencia que explicar."
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />

        {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}
        <Button type="submit" disabled={create.isPending || chosen.length === 0}>
          {create.isPending ? 'Conciliando…' : 'Conciliar seleccionados'}
        </Button>
      </form>
    </Card>
  );
}
