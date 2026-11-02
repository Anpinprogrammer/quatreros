import type {
  CreatePresentationRequest,
  CreateProductRequest,
  CreateRawMaterialRequest,
  PriceView,
  ProductKind,
  ProductPage,
  ProductView,
  RawMaterialPage,
  RawMaterialView,
  SetPriceRequest,
  UpdatePresentationRequest,
  UpdateProductRequest,
  UpdateRawMaterialRequest,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

const CATALOG_KEY = ['catalog'] as const;

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useProducts(
  params: {
    q?: string | undefined;
    kind?: ProductKind | undefined;
    status: 'active' | 'inactive' | 'all';
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...CATALOG_KEY, 'products', params],
    queryFn: () => apiRequest<ProductPage>(`/api/v1/catalog/products${query(params)}`),
    enabled: options?.enabled ?? true,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: [...CATALOG_KEY, 'product', id],
    queryFn: () => apiRequest<{ data: ProductView }>(`/api/v1/catalog/products/${id}`).then((r) => r.data),
  });
}

export function usePrices(presentationId: string | null) {
  return useQuery({
    queryKey: [...CATALOG_KEY, 'prices', presentationId],
    queryFn: () =>
      apiRequest<{ data: PriceView[] }>(`/api/v1/catalog/presentations/${presentationId ?? ''}/prices`).then(
        (r) => r.data,
      ),
    enabled: Boolean(presentationId),
  });
}

export function useRawMaterials(params: { q?: string | undefined; status: 'active' | 'inactive' | 'all' }) {
  return useQuery({
    queryKey: [...CATALOG_KEY, 'raw-materials', params],
    queryFn: () => apiRequest<RawMaterialPage>(`/api/v1/catalog/raw-materials${query(params)}`),
  });
}

const invalidate = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: CATALOG_KEY });

export function useCreateProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateProductRequest; idempotencyKey: string }) =>
      apiRequest<{ data: ProductView }>('/api/v1/catalog/products', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useUpdateProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ product, input }: { product: ProductView; input: UpdateProductRequest }) =>
      apiRequest<{ data: ProductView }>(`/api/v1/catalog/products/${product.id}`, {
        method: 'PATCH',
        body: input,
        ifMatch: `"v${String(product.version)}"`,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useCreatePresentation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      input,
      idempotencyKey,
    }: {
      productId: string;
      input: CreatePresentationRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: unknown }>(`/api/v1/catalog/products/${productId}/presentations`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useUpdatePresentation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      presentation,
      input,
    }: {
      presentation: { id: string; version: number };
      input: UpdatePresentationRequest;
    }) =>
      apiRequest<{ data: unknown }>(`/api/v1/catalog/presentations/${presentation.id}`, {
        method: 'PATCH',
        body: input,
        ifMatch: `"v${String(presentation.version)}"`,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useSetPrice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      presentationId,
      input,
      idempotencyKey,
    }: {
      presentationId: string;
      input: SetPriceRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: PriceView }>(`/api/v1/catalog/presentations/${presentationId}/prices`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useCreateRawMaterial() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateRawMaterialRequest; idempotencyKey: string }) =>
      apiRequest<{ data: RawMaterialView }>('/api/v1/catalog/raw-materials', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useUpdateRawMaterial() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ material, input }: { material: RawMaterialView; input: UpdateRawMaterialRequest }) =>
      apiRequest<{ data: RawMaterialView }>(`/api/v1/catalog/raw-materials/${material.id}`, {
        method: 'PATCH',
        body: input,
        ifMatch: `"v${String(material.version)}"`,
      }),
    onSuccess: () => invalidate(client),
  });
}
