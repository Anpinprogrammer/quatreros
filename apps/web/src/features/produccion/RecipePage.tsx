import type { MeResponse, RecipeVersionView } from '@quatreros/contracts';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { Link, useParams } from 'react-router';
import { newIdempotencyKey, type ApiError } from '../../shared/api/client';
import { hasPermission } from '../../shared/auth/session';
import { Badge } from '../../shared/ui/Badge';
import { Card, CardLabel } from '../../shared/ui/Card';
import { DataTable } from '../../shared/ui/DataTable';
import { Alert, Button, SelectField, TextField } from '../../shared/ui/form';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useRawMaterials } from '../catalogo/api';
import { useCreateRecipeVersion, useRecipe } from './api';
import { formatDateTime, formatPercent, formatQuantity } from './format';

/** Detalle de receta y publicación de versiones (RF-033, BR-062). */
export function RecipePage({ me }: { me: MeResponse }) {
  const { id = '' } = useParams();
  const recipe = useRecipe(id);
  const canManage = hasPermission(me, 'prod.recipe.manage');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const currentVersion =
    recipe.data?.versions.find((version) => version.isCurrent) ?? recipe.data?.versions[0];
  useDocumentTitle(recipe.data ? `Receta ${recipe.data.productName}` : 'Receta');

  return (
    <section aria-labelledby="receta-titulo" className="space-y-8">
      <Link
        to="/erp/produccion"
        className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Producción
      </Link>

      {recipe.isPending ? <LoadingSkeleton label="Cargando receta…" rows={2} /> : null}
      {recipe.error ? <Alert>{recipe.error.message}</Alert> : null}

      {recipe.data ? (
        <>
          <PageHeader
            titleId="receta-titulo"
            title={`Receta · ${recipe.data.productName}`}
            description="Una receta por producto fabricado. Publicar una versión nueva no cambia las órdenes existentes."
            meta={<Badge tone="info">Versión vigente v{recipe.data.currentVersion.version}</Badge>}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardLabel>Producción base</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">
                {formatQuantity(recipe.data.currentVersion.baseOutputQty)} {recipe.data.baseUnit}
              </p>
            </Card>
            <Card>
              <CardLabel>Rendimiento esperado</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">
                {formatPercent(recipe.data.currentVersion.expectedYieldPct)}
              </p>
            </Card>
            <Card>
              <CardLabel>Tolerancia</CardLabel>
              <p className="mt-2 font-mono text-title text-ink">
                ± {formatPercent(recipe.data.currentVersion.tolerancePct)}
              </p>
            </Card>
            <Card>
              <CardLabel>Publicada</CardLabel>
              <p className="mt-2 text-body font-semibold text-ink">
                {formatDateTime(recipe.data.currentVersion.publishedAt)}
              </p>
            </Card>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {creatingVersion ? null : (
                <Button
                  onClick={() => {
                    setCreatingVersion(true);
                  }}
                >
                  <Plus aria-hidden className="size-4" /> Publicar versión nueva
                </Button>
              )}
            </div>
          ) : null}

          {creatingVersion && currentVersion ? (
            <RecipeVersionForm
              recipeId={recipe.data.id}
              current={currentVersion}
              onDone={() => {
                setCreatingVersion(false);
              }}
              onCancel={() => {
                setCreatingVersion(false);
              }}
            />
          ) : null}

          <section aria-labelledby="versiones-receta" className="space-y-4">
            <h2 id="versiones-receta" className="font-display text-title font-bold text-ink">
              Versiones
            </h2>
            {recipe.data.versions.map((version) => (
              <Card key={version.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-card font-semibold text-ink">Versión {version.version}</p>
                    <p className="text-caption text-ink-2">
                      {formatQuantity(version.baseOutputQty)} {recipe.data.baseUnit} base · rendimiento{' '}
                      {formatPercent(version.expectedYieldPct)} ± {formatPercent(version.tolerancePct)} ·{' '}
                      {formatDateTime(version.publishedAt)}
                    </p>
                  </div>
                  <Badge tone={version.isCurrent ? 'success' : 'neutral'}>
                    {version.isCurrent ? 'Vigente' : 'Histórica'}
                  </Badge>
                </div>
                <DataTable minWidth="40rem" label={`Ingredientes de la versión ${String(version.version)}`}>
                  <caption className="sr-only">Ingredientes y cantidades por producción base</caption>
                  <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
                    <tr>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Materia prima
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">
                        Cantidad
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.lines.map((line) => (
                      <tr key={line.rawMaterialId} className="border-b border-line last:border-0">
                        <td className="px-3 py-3">{line.rawMaterialName}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {formatQuantity(line.quantity)} {line.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}

interface VersionLine {
  rawMaterialId: string;
  quantity: string;
}

function RecipeVersionForm({
  recipeId,
  current,
  onDone,
  onCancel,
}: {
  recipeId: string;
  current: RecipeVersionView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const materials = useRawMaterials({ status: 'active' });
  const create = useCreateRecipeVersion();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [baseOutputQty, setBaseOutputQty] = useState(current.baseOutputQty);
  const [expectedYieldPct, setExpectedYieldPct] = useState(current.expectedYieldPct);
  const [tolerancePct, setTolerancePct] = useState(current.tolerancePct);
  const [lines, setLines] = useState<VersionLine[]>(
    current.lines.map((line) => ({ rawMaterialId: line.rawMaterialId, quantity: line.quantity })),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const error = create.error as ApiError | null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    for (const line of lines) {
      if (!line.rawMaterialId) {
        setLocalError('Selecciona la materia prima de cada ingrediente.');
        return;
      }
      if (!/^\d{1,11}(\.\d{1,3})?$/.test(line.quantity) || Number(line.quantity) <= 0) {
        setLocalError('Cada cantidad debe ser mayor que 0, con hasta 3 decimales.');
        return;
      }
    }
    create.mutate(
      {
        recipeId,
        input: { baseOutputQty, expectedYieldPct, tolerancePct, lines },
        idempotencyKey,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label="Nueva versión de receta"
    >
      <h3 className="font-display text-title font-bold text-ink">Nueva versión de receta</h3>
      {localError ? <Alert>{localError}</Alert> : null}
      {error ? <Alert>{error.message}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          label="Producción base"
          type="number"
          min={0.001}
          step={0.001}
          value={baseOutputQty}
          onChange={(e) => {
            setBaseOutputQty(e.target.value);
          }}
        />
        <TextField
          label="Rendimiento esperado %"
          type="number"
          min={0.01}
          max={100}
          step={0.01}
          value={expectedYieldPct}
          onChange={(e) => {
            setExpectedYieldPct(e.target.value);
          }}
        />
        <TextField
          label="Tolerancia %"
          type="number"
          min={0}
          step={0.01}
          value={tolerancePct}
          onChange={(e) => {
            setTolerancePct(e.target.value);
          }}
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-body font-semibold text-ink">Ingredientes</h4>
          <Button
            variant="secondary"
            onClick={() => {
              setLines((currentLines) => [...currentLines, { rawMaterialId: '', quantity: '' }]);
            }}
          >
            <Plus aria-hidden className="size-4" /> Agregar
          </Button>
        </div>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
          >
            <SelectField
              label={`Ingrediente ${String(index + 1)}`}
              options={[
                { value: '', label: 'Selecciona la materia prima' },
                ...(materials.data?.data ?? []).map((material) => ({
                  value: material.id,
                  label: `${material.name} (${material.unit})`,
                })),
              ]}
              value={line.rawMaterialId}
              onChange={(e) => {
                setLines((currentLines) =>
                  currentLines.map((item, i) =>
                    i === index ? { ...item, rawMaterialId: e.target.value } : item,
                  ),
                );
              }}
            />
            <TextField
              label="Cantidad"
              type="number"
              min={0.001}
              step={0.001}
              value={line.quantity}
              onChange={(e) => {
                setLines((currentLines) =>
                  currentLines.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)),
                );
              }}
            />
            <div className="flex items-end">
              <Button
                variant="ghost"
                aria-label={`Quitar ingrediente ${String(index + 1)}`}
                disabled={lines.length === 1}
                onClick={() => {
                  setLines((currentLines) => currentLines.filter((_, i) => i !== index));
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Publicando…' : 'Publicar versión'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
