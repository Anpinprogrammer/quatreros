import type {
  CloseProductionOrderRequest,
  ConsumeProductionOrderRequest,
  CreateProductionOrderRequest,
  CreateRecipeRequest,
  CreateRecipeVersionRequest,
  ProductionOrderDetail,
  ProductionOrderPage,
  ProductionOrderStatus,
  ProductionPreview,
  RecipeDetail,
  RecipePage,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../shared/api/client';

const KEY = ['production'] as const;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
    else if (typeof value === 'number') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useRecipes(params: { q?: string | undefined; limit?: number | undefined } = {}) {
  return useQuery({
    queryKey: [...KEY, 'recipes', params],
    queryFn: () => apiRequest<RecipePage>(`/api/v1/catalog/recipes${query(params)}`),
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: [...KEY, 'recipe', id],
    queryFn: () => apiRequest<{ data: RecipeDetail }>(`/api/v1/catalog/recipes/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreateRecipe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateRecipeRequest; idempotencyKey: string }) =>
      apiRequest<{ data: RecipeDetail }>('/api/v1/catalog/recipes', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateRecipeVersion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      recipeId,
      input,
      idempotencyKey,
    }: {
      recipeId: string;
      input: CreateRecipeVersionRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: RecipeDetail }>(`/api/v1/catalog/recipes/${recipeId}/versions`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useProductionPreview(params: {
  productId?: string | undefined;
  siteId?: string | undefined;
  plannedQty?: string | undefined;
}) {
  const enabled = Boolean(params.productId && params.siteId && params.plannedQty);
  return useQuery({
    queryKey: [...KEY, 'preview', params],
    queryFn: () =>
      apiRequest<{ data: ProductionPreview }>(`/api/v1/production/availability${query(params)}`).then(
        (r) => r.data,
      ),
    enabled,
  });
}

export function useOrders(params: {
  status?: ProductionOrderStatus | undefined;
  q?: string | undefined;
  limit?: number | undefined;
}) {
  return useQuery({
    queryKey: [...KEY, 'orders', params],
    queryFn: () => apiRequest<ProductionOrderPage>(`/api/v1/production/orders${query(params)}`),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: [...KEY, 'order', id],
    queryFn: () =>
      apiRequest<{ data: ProductionOrderDetail }>(`/api/v1/production/orders/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateProductionOrderRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: ProductionOrderDetail }>('/api/v1/production/orders', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useConsumeOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      input,
      idempotencyKey,
    }: {
      orderId: string;
      input: ConsumeProductionOrderRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: ProductionOrderDetail }>(`/api/v1/production/orders/${orderId}/consume`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: KEY });
      void client.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCloseOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      input,
      idempotencyKey,
    }: {
      orderId: string;
      input: CloseProductionOrderRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: ProductionOrderDetail }>(`/api/v1/production/orders/${orderId}/close`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: KEY });
      void client.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
