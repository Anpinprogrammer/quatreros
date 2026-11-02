import { BASE_UNITS, BASE_UNIT_LABELS, type BaseUnit, type RawMaterialView } from '@quatreros/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { Alert, Button, CheckboxField, SelectField, TextField } from '../ui/form';
import { useCreateRawMaterial, useUpdateRawMaterial } from '../../services/catalogo';

const unitOptions = BASE_UNITS.map((value) => ({ value, label: BASE_UNIT_LABELS[value] }));

/** RF-031: crear o editar una materia prima. La unidad no cambia si ya hay movimientos. */
export function RawMaterialForm({
  material,
  onDone,
  onCancel,
}: {
  material?: RawMaterialView;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateRawMaterial();
  const update = useUpdateRawMaterial();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [name, setName] = useState(material?.name ?? '');
  const [unit, setUnit] = useState<BaseUnit>(material?.unit ?? 'kg');
  const [tracksExpiry, setTracksExpiry] = useState(material?.tracksExpiry ?? false);
  const [isActive, setIsActive] = useState(material?.isActive ?? true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const error = (create.error ?? update.error) as ApiError | null;
  const busy = create.isPending || update.isPending;
  const nameTaken = error?.code === 'NAME_TAKEN' ? error.message : undefined;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!error) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    invalid?.focus();
  }, [error]);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (material) {
      update.mutate(
        { material, input: { name, unit, tracksExpiry, isActive } },
        {
          onSuccess: () => {
            onDone(`Cambios guardados para ${name}.`);
          },
        },
      );
    } else {
      create.mutate(
        { input: { name, unit, tracksExpiry }, idempotencyKey },
        {
          onSuccess: () => {
            onDone(`${name} quedó en el catálogo de materias primas.`);
          },
        },
      );
    }
  };

  return (
    <form
      ref={formRef}
      className="mt-6 flex max-w-2xl flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      aria-label={material ? `Editar ${material.name}` : 'Crear materia prima'}
    >
      <h2
        ref={titleRef}
        tabIndex={-1}
        className="scroll-mt-4 font-display text-title font-bold text-ink outline-none"
      >
        {material ? `Editar ${material.name}` : 'Nueva materia prima'}
      </h2>

      {error && !error.problem.errors && !nameTaken ? <Alert>{error.message}</Alert> : null}

      <TextField
        label="Nombre"
        required
        autoComplete="off"
        value={name}
        error={error?.fieldError('name') ?? nameTaken}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />

      <SelectField
        label="Unidad de inventario"
        options={unitOptions}
        value={unit}
        hint="No se puede cambiar si la materia prima ya tiene existencias o movimientos."
        error={error?.fieldError('unit')}
        onChange={(e) => {
          setUnit(e.target.value as BaseUnit);
        }}
      />

      <CheckboxField
        label="Controla vencimiento"
        hint="Si lo controla, cada lote de esta materia prima debe registrar su fecha de vencimiento."
        checked={tracksExpiry}
        onChange={setTracksExpiry}
      />

      {material ? (
        <CheckboxField
          label="Materia prima activa"
          hint="Una materia prima inactiva no se puede usar en compras ni recetas."
          checked={isActive}
          onChange={setIsActive}
        />
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : material ? 'Guardar cambios' : 'Crear materia prima'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
