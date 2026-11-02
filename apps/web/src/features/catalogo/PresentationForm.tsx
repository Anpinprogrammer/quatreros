import type { PresentationView } from '@quatreros/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { newIdempotencyKey, type ApiError } from '../../shared/api/client';
import { Alert, Button, CheckboxField, TextField } from '../../shared/ui/form';
import { useCreatePresentation, useUpdatePresentation } from './api';

/** RF-030: crear o editar una presentación (unidad, paquete × N). */
export function PresentationForm({
  productId,
  presentation,
  onDone,
  onCancel,
}: {
  productId: string;
  presentation?: PresentationView;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const create = useCreatePresentation();
  const update = useUpdatePresentation();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [name, setName] = useState(presentation?.name ?? '');
  const [unitsPer, setUnitsPer] = useState(presentation?.unitsPer ?? '1');
  const [isActive, setIsActive] = useState(presentation?.isActive ?? true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const error = (create.error ?? update.error) as ApiError | null;
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!error) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [error]);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = { name, unitsPer, ...(presentation ? { isActive } : {}) };
    if (presentation) {
      update.mutate(
        { presentation, input },
        {
          onSuccess: () => {
            onDone(`Cambios guardados en ${name}.`);
          },
        },
      );
    } else {
      create.mutate(
        { productId, input: { name, unitsPer }, idempotencyKey },
        {
          onSuccess: () => {
            onDone(`Presentación ${name} agregada.`);
          },
        },
      );
    }
  };

  return (
    <form
      ref={formRef}
      className="mt-4 flex max-w-2xl flex-col gap-4 rounded-2xl border border-grill bg-char p-4"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      aria-label={presentation ? `Editar ${presentation.name}` : 'Agregar presentación'}
    >
      <h3 ref={titleRef} tabIndex={-1} className="text-title font-semibold outline-none">
        {presentation ? `Editar ${presentation.name}` : 'Nueva presentación'}
      </h3>

      {error && !error.problem.errors ? <Alert>{error.message}</Alert> : null}

      <TextField
        label="Nombre"
        required
        autoComplete="off"
        placeholder="Unidad, Paquete x10…"
        value={name}
        error={error?.fieldError('name')}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <TextField
        label="Unidades base por presentación"
        type="number"
        min={0.001}
        step={0.001}
        required
        inputMode="decimal"
        value={unitsPer}
        hint="Ej.: 1 para la unidad; 10 para un paquete × 10."
        error={error?.fieldError('unitsPer')}
        onChange={(e) => {
          setUnitsPer(e.target.value);
        }}
      />
      {presentation ? (
        <CheckboxField
          label="Presentación activa"
          hint="Una presentación inactiva no se puede vender ni cambiar de precio."
          checked={isActive}
          onChange={setIsActive}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : presentation ? 'Guardar cambios' : 'Agregar presentación'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
