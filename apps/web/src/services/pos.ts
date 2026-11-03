import type {
  CloseShiftRequest,
  CreateDishRecipeRequest,
  CreateDishRecipeVersionRequest,
  CreateSaleRequest,
  DishRecipeDetail,
  DishRecipePage,
  OpenShiftRequest,
  PosCatalog,
  ReviewShiftRequest,
  SaleDetail,
  ShiftDetail,
  ShiftPage,
  ShiftStatus,
  ShiftSummary,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

const KEY = ['pos'] as const;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
    else if (typeof value === 'number') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const invalidate = (client: ReturnType<typeof useQueryClient>) => client.invalidateQueries({ queryKey: KEY });

export function usePosCatalog(siteId?: string) {
  return useQuery({
    queryKey: [...KEY, 'catalog', siteId],
    queryFn: () =>
      apiRequest<{ data: PosCatalog }>(`/api/v1/pos/catalog${query({ siteId })}`).then((r) => r.data),
  });
}

export function useCurrentShift(siteId?: string) {
  return useQuery({
    queryKey: [...KEY, 'shift', 'current', siteId],
    queryFn: () =>
      apiRequest<{ data: ShiftSummary | null }>(`/api/v1/pos/shifts/current${query({ siteId })}`).then(
        (r) => r.data,
      ),
  });
}

export function useOpenShift() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: OpenShiftRequest; idempotencyKey: string }) =>
      apiRequest<{ data: ShiftSummary }>('/api/v1/pos/shifts', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useShifts(params: { status?: ShiftStatus | undefined; limit?: number | undefined } = {}) {
  return useQuery({
    queryKey: [...KEY, 'shifts', params],
    queryFn: () => apiRequest<ShiftPage>(`/api/v1/pos/shifts${query(params)}`),
  });
}

export function useShift(id: string) {
  return useQuery({
    queryKey: [...KEY, 'shift', id],
    queryFn: () => apiRequest<{ data: ShiftDetail }>(`/api/v1/pos/shifts/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreateSale() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateSaleRequest; idempotencyKey: string }) =>
      apiRequest<{ data: SaleDetail }>('/api/v1/pos/sales', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useCloseShift() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey,
    }: {
      id: string;
      input: CloseShiftRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: ShiftDetail }>(`/api/v1/pos/shifts/${id}/close`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useReviewShift() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey,
    }: {
      id: string;
      input: ReviewShiftRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: ShiftDetail }>(`/api/v1/pos/shifts/${id}/review`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useDishRecipes(params: { q?: string | undefined; limit?: number | undefined } = {}) {
  return useQuery({
    queryKey: [...KEY, 'dish-recipes', params],
    queryFn: () => apiRequest<DishRecipePage>(`/api/v1/pos/dish-recipes${query(params)}`),
  });
}

export function useDishRecipe(id: string) {
  return useQuery({
    queryKey: [...KEY, 'dish-recipe', id],
    queryFn: () =>
      apiRequest<{ data: DishRecipeDetail }>(`/api/v1/pos/dish-recipes/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreateDishRecipe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateDishRecipeRequest; idempotencyKey: string }) =>
      apiRequest<{ data: DishRecipeDetail }>('/api/v1/pos/dish-recipes', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useCreateDishRecipeVersion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey,
    }: {
      id: string;
      input: CreateDishRecipeVersionRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: DishRecipeDetail }>(`/api/v1/pos/dish-recipes/${id}/versions`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}
