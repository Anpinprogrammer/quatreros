import {
  BASE_UNITS,
  BASE_UNIT_LABELS,
  PRODUCT_KIND_LABELS,
  ProductKind,
  type BaseUnit,
  type ProductKind as ProductKindType,
  type ProductView,
} from '@quatreros/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { newIdempotencyKey, type ApiError } from '../../shared/api/client';
import { Alert, Button, CheckboxField, SelectField, TextField } from '../../shared/ui/form';
import { useCreateProduct, useUpdateProduct } from './api';

const kindOptions = ProductKind.options.map((value) => ({ value, label: PRODUCT_KIND_LABELS[value] }));
const unitOptions = BASE_UNITS.map((value) => ({ value, label: BASE_UNIT_LABELS[value] }));

/** RF-030: crear o editar un producto. El tipo no se cambia; la unidad sí (si no hay movimientos). */
export function ProductForm({
  product,
  onDone,
  onCancel,
}: {
  product?: ProductView;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [name, setName] = useState(product?.name ?? '');
  const [kind, setKind] = useState<ProductKindType>(product?.kind ?? 'manufactured');
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(product?.baseUnit ?? 'unidad');
  const [shelfLifeDays, setShelfLifeDays] = useState(
    product?.shelfLifeDays != null ? String(product.shelfLifeDays) : '',
  );
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [localError, setLocalError] = useState<string | null>(null);
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
    setLocalError(null);
    const days = shelfLifeDays.trim() === '' ? null : Number(shelfLifeDays);
    if (kind === 'manufactured' && (days == null || !Number.isInteger(days) || days < 1)) {
      setLocalError('Un producto fabricado necesita una vida útil en días (mínimo 1).');
      return;
    }
    if (product) {
      update.mutate(
        {
          product,
          input: {
            name,
            baseUnit,
            shelfLifeDays: kind === 'manufactured' ? days : null,
            isActive,
          },
        },
        {
          onSuccess: () => {
            onDone(`Cambios guardados para ${name}.`);
          },
        },
      );
    } else {
      create.mutate(
        {
          input: {
            name,
            kind,
            baseUnit,
            shelfLifeDays: kind === 'manufactured' ? days : null,
          },
          idempotencyKey,
        },
        {
          onSuccess: () => {
            onDone(`${name} quedó en el catálogo.`);
          },
        },
      );
    }
  };

  return (
    <form
      ref={formRef}
      className="mt-6 flex max-w-2xl flex-col gap-5 rounded-2xl border border-grill bg-smoke p-5 shadow-xl md:p-6"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      aria-label={product ? `Editar ${product.name}` : 'Crear producto'}
    >
      <h2 ref={titleRef} tabIndex={-1} className="scroll-mt-4 text-title font-semibold outline-none">
        {product ? `Editar ${product.name}` : 'Nuevo producto'}
      </h2>

      {localError ? <Alert>{localError}</Alert> : null}
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

      {product ? (
        <p className="text-body text-ash">
          Tipo: <span className="font-semibold text-chalk">{PRODUCT_KIND_LABELS[product.kind]}</span>. El tipo
          no se cambia; si necesitas otro, crea un producto nuevo y desactiva este.
        </p>
      ) : (
        <SelectField
          label="Tipo"
          options={kindOptions}
          value={kind}
          error={error?.fieldError('kind')}
          onChange={(e) => {
            setKind(e.target.value as ProductKindType);
          }}
        />
      )}

      <SelectField
        label="Unidad base"
        options={unitOptions}
        value={baseUnit}
        hint="La unidad en la que se lleva el inventario. No se puede cambiar si el producto ya tiene existencias."
        error={error?.fieldError('baseUnit')}
        onChange={(e) => {
          setBaseUnit(e.target.value as BaseUnit);
        }}
      />

      {kind === 'manufactured' ? (
        <TextField
          label="Vida útil (días)"
          type="number"
          min={1}
          max={3650}
          required
          inputMode="numeric"
          value={shelfLifeDays}
          hint="El vencimiento de cada lote se calcula desde la fecha de fabricación (DEC-090)."
          error={error?.fieldError('shelfLifeDays')}
          onChange={(e) => {
            setShelfLifeDays(e.target.value);
          }}
        />
      ) : null}

      {product ? (
        <CheckboxField
          label="Producto activo"
          hint="Un producto inactivo no admite presentaciones ni precios nuevos."
          checked={isActive}
          onChange={setIsActive}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
