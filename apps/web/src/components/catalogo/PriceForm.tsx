import type { PresentationView } from '@quatreros/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { Alert, Button, TextField } from '../ui/form';
import { useSetPrice } from '../../services/catalogo';
import { formatMoney } from '../../lib/format/catalogo';

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** RF-032: fijar el precio vigente de una presentación. */
export function PriceForm({
  presentation,
  onDone,
  onCancel,
}: {
  presentation: PresentationView;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const savePrice = useSetPrice();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [price, setPrice] = useState(presentation.currentPrice ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const error = savePrice.error as ApiError | null;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!error) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [error]);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);
    if (!MONEY.test(price) || Number(price) <= 0) {
      setLocalError('Escribe un precio mayor que 0, con máximo 2 decimales. Ej.: 12000.00');
      return;
    }
    savePrice.mutate(
      { presentationId: presentation.id, input: { price }, idempotencyKey },
      {
        onSuccess: () => {
          onDone(`Precio de ${presentation.name} actualizado.`);
        },
      },
    );
  };

  return (
    <form
      ref={formRef}
      className="mt-3 flex flex-col gap-4 rounded-xl border border-line bg-surface-2 p-4"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      aria-label={`Cambiar precio de ${presentation.name}`}
    >
      <h3 ref={titleRef} tabIndex={-1} className="text-body font-semibold text-ink outline-none">
        {presentation.currentPrice ? 'Cambiar precio' : 'Fijar precio'} · {presentation.name}
      </h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      <TextField
        label="Precio (COP)"
        type="text"
        inputMode="decimal"
        required
        autoComplete="off"
        className="font-mono"
        value={price}
        hint={
          presentation.currentPrice
            ? `Vigente: ${formatMoney(presentation.currentPrice)}. El anterior queda en el histórico.`
            : 'Escribe el valor sin separadores de miles. Ej.: 12000.00'
        }
        error={error?.fieldError('price')}
        onChange={(e) => {
          setPrice(e.target.value);
        }}
      />
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button type="submit" disabled={savePrice.isPending}>
          {savePrice.isPending ? 'Guardando…' : 'Guardar precio'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
