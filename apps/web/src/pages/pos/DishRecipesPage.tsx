import type { DishRecipeSummary } from '@quatreros/contracts';
import { BookOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardLabel } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { DishRecipeForm } from '../../components/pos/DishRecipeForm';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatQuantity } from '../../lib/format/pos';
import { useDishRecipes } from '../../services/pos';

/** Gestión de recetas de platos para calcular consumo teórico (RF-225). */
export function DishRecipesPage() {
  useDocumentTitle('Recetas de platos');
  const [q, setQ] = useState('');
  const recipes = useDishRecipes({ q, limit: 50 });
  const [editing, setEditing] = useState<'create' | DishRecipeSummary | null>(null);

  return (
    <section aria-labelledby="recetas-titulo" className="space-y-6">
      <PageHeader
        titleId="recetas-titulo"
        eyebrow="POS y cocina · Recetas"
        title="Recetas de platos"
        description="Ingredientes y cantidades de cada plato. La venta registra consumo teórico sin descontar cocina (BR-147)."
        actions={
          <Button
            onClick={() => {
              setEditing('create');
            }}
          >
            <Plus aria-hidden className="size-4" />
            Nueva receta
          </Button>
        }
        meta={<Badge tone="info">{recipes.data?.data.length ?? 0} recetas</Badge>}
      />

      <div className="max-w-md">
        <SearchInput
          label="Buscar plato"
          placeholder="Nombre del plato"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
      </div>

      {editing ? (
        <Card>
          <CardLabel>
            {editing === 'create' ? 'Nueva receta' : `Nueva versión de ${editing.productName}`}
          </CardLabel>
          <div className="mt-4">
            <DishRecipeForm
              key={editing === 'create' ? 'create' : editing.id}
              {...(editing === 'create' ? {} : { recipe: editing })}
              onDone={() => {
                setEditing(null);
              }}
              onCancel={() => {
                setEditing(null);
              }}
            />
          </div>
        </Card>
      ) : null}

      {recipes.isPending ? <LoadingSkeleton label="Cargando recetas…" rows={2} /> : null}
      {recipes.error ? <Alert tone="error">{recipes.error.message}</Alert> : null}
      {recipes.data?.data.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="Todavía no hay recetas de platos"
          description="Crea la primera para que el POS calcule el consumo teórico de los platos vendidos."
        />
      ) : null}

      {recipes.data && recipes.data.data.length > 0 ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {recipes.data.data.map((recipe) => (
            <li key={recipe.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardLabel>Versión {recipe.currentVersion.version}</CardLabel>
                    <h2 className="mt-1 font-display text-title font-bold text-ink">{recipe.productName}</h2>
                    <p className="text-caption text-ink-2">
                      Producción base {formatQuantity(recipe.currentVersion.baseOutputQty)}
                    </p>
                  </div>
                  <Badge tone="success">Vigente</Badge>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {recipe.currentVersion.components.map((component) => (
                    <li
                      key={`${component.rawMaterialId ?? component.presentationId}`}
                      className="flex items-baseline justify-between gap-3 text-body"
                    >
                      <span className="text-ink-2">{component.name}</span>
                      <span className="font-mono text-ink">
                        {formatQuantity(component.quantity)} {component.unit}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 self-start"
                  variant="secondary"
                  onClick={() => {
                    setEditing(recipe);
                  }}
                >
                  Publicar nueva versión
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
