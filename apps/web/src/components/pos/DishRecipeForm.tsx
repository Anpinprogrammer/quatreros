import type { DishRecipeSummary } from '@quatreros/contracts';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { SelectField, Alert, Button, TextField } from '../ui/form';
import { useProducts, useRawMaterials } from '../../services/catalogo';
import { newIdempotencyKey } from '../../services/client';
import { useCreateDishRecipe, useCreateDishRecipeVersion } from '../../services/pos';

interface ComponentDraft {
  key: string;
  quantity: string;
}

/** Formulario de receta de plato: producto preparado + componentes versionados (RF-225). */
export function DishRecipeForm({
  recipe,
  onDone,
  onCancel,
}: {
  recipe?: DishRecipeSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const products = useProducts({ kind: 'prepared', status: 'active' });
  const materials = useRawMaterials({ status: 'active' });
  const create = useCreateDishRecipe();
  const createVersion = useCreateDishRecipeVersion();
  const [productId, setProductId] = useState(recipe?.productId ?? '');
  const [baseOutputQty, setBaseOutputQty] = useState(recipe?.currentVersion.baseOutputQty ?? '1.000');
  const [components, setComponents] = useState<ComponentDraft[]>(
    recipe
      ? recipe.currentVersion.components.map((component) => ({
          key: component.presentationId ? `p:${component.presentationId}` : `r:${component.rawMaterialId}`,
          quantity: component.quantity,
        }))
      : [{ key: '', quantity: '1.000' }],
  );
  const [idempotencyKey] = useState(newIdempotencyKey);

  const prepared = (products.data?.data ?? []).filter((product) => product.kind === 'prepared');
  const productOptions = [
    { value: '', label: 'Selecciona un plato' },
    ...prepared.map((product) => ({ value: product.id, label: product.name })),
  ];
  const componentOptions = [
    { value: '', label: 'Selecciona un componente' },
    ...prepared.flatMap((product) =>
      product.presentations.map((presentation) => ({
        value: `p:${presentation.id}`,
        label: `Presentación · ${product.name} · ${presentation.name}`,
      })),
    ),
    ...(materials.data?.data ?? []).map((material) => ({
      value: `r:${material.id}`,
      label: `Materia prima · ${material.name}`,
    })),
  ];

  const busy = create.isPending || createVersion.isPending;
  const error = create.error ?? createVersion.error;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valid = components
      .filter((component) => component.key)
      .map((component) =>
        component.key.startsWith('p:')
          ? { presentationId: component.key.slice(2), quantity: component.quantity }
          : { rawMaterialId: component.key.slice(2), quantity: component.quantity },
      );
    if (valid.length === 0) return;
    const input = { baseOutputQty, components: valid };
    if (recipe) {
      createVersion.mutate({ id: recipe.id, input, idempotencyKey }, { onSuccess: onDone });
    } else {
      create.mutate({ input: { productId, ...input }, idempotencyKey }, { onSuccess: onDone });
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Plato preparado"
          options={productOptions}
          value={productId}
          disabled={Boolean(recipe)}
          hint={recipe ? 'El producto no cambia entre versiones.' : 'Solo productos de tipo preparado.'}
          onChange={(event) => {
            setProductId(event.target.value);
          }}
        />
        <TextField
          label="Producción base"
          type="number"
          min="0.001"
          step="0.001"
          inputMode="decimal"
          value={baseOutputQty}
          hint="Cantidad de porciones que produce la receta."
          onChange={(event) => {
            setBaseOutputQty(event.target.value);
          }}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-body font-semibold text-ink">Componentes</legend>
        {components.map((component, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
            <SelectField
              label={index === 0 ? 'Componente' : `Componente ${String(index + 1)}`}
              options={componentOptions}
              value={component.key}
              onChange={(event) => {
                const key = event.target.value;
                setComponents((current) =>
                  current.map((item, itemIndex) => (itemIndex === index ? { ...item, key } : item)),
                );
              }}
            />
            <TextField
              label="Cantidad"
              type="number"
              min="0.001"
              step="0.001"
              inputMode="decimal"
              value={component.quantity}
              onChange={(event) => {
                const quantity = event.target.value;
                setComponents((current) =>
                  current.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity } : item)),
                );
              }}
            />
            <Button
              type="button"
              variant="ghost"
              aria-label="Quitar componente"
              disabled={components.length === 1}
              onClick={() => {
                setComponents((current) => current.filter((_, itemIndex) => itemIndex !== index));
              }}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setComponents((current) => [...current, { key: '', quantity: '1.000' }]);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Agregar componente
        </Button>
      </fieldset>

      {error ? <Alert tone="error">{error.message}</Alert> : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={busy || (!recipe && !productId)}>
          {busy ? 'Guardando…' : recipe ? 'Publicar versión' : 'Crear receta'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
