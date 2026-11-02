import type { PaymentMethodView, ShiftDetail } from '@quatreros/contracts';
import { useState } from 'react';
import { toAmount } from '../../lib/format/pos';
import { newIdempotencyKey } from '../../services/client';
import { useCloseShift } from '../../services/pos';
import { Alert, Button, TextField } from '../ui/form';
import { PosDialog } from './PosDialog';

/** Cierre de turno: conteo por método, diferencia y justificación si hay faltante o sobrante. */
export function CloseShiftDialog({
  open,
  shiftId,
  methods,
  onClose,
  onClosed,
}: {
  open: boolean;
  shiftId: string;
  methods: PaymentMethodView[];
  onClose: () => void;
  onClosed: (shift: ShiftDetail) => void;
}) {
  const close = useCloseShift();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [idempotencyKey] = useState(newIdempotencyKey);

  const submit = () => {
    close.mutate(
      {
        id: shiftId,
        input: {
          counts: methods.map((method) => ({
            paymentMethodId: method.id,
            countedAmount: toAmount(counts[method.id] ?? '0'),
          })),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        idempotencyKey,
      },
      {
        onSuccess: (res) => {
          onClosed(res.data);
          onClose();
        },
      },
    );
  };

  return (
    <PosDialog
      open={open}
      title="Cerrar turno"
      description="Cuenta el dinero por método. Si el efectivo no coincide, explica la diferencia."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={close.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={close.isPending}>
            {close.isPending ? 'Cerrando…' : 'Cerrar turno'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {methods.map((method) => (
          <TextField
            key={method.id}
            label={`${method.name} contado`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={counts[method.id] ?? ''}
            onChange={(event) => {
              setCounts((current) => ({ ...current, [method.id]: event.target.value }));
            }}
          />
        ))}
        <TextField
          label="Justificación de la diferencia"
          value={note}
          hint="Obligatoria si el efectivo contado no coincide con el esperado (BR-145)."
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
        {close.error ? <Alert tone="error">{close.error.message}</Alert> : null}
      </div>
    </PosDialog>
  );
}
