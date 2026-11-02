import type {
  CreatePurchaseRequest,
  CreateSupplierRequest,
  PurchaseDetail,
  PurchasePage,
  PurchaseStatus,
  ReceivePurchaseRequest,
  SupplierPage,
  SupplierView,
  UpdateSupplierRequest,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

const KEY = ['purchasing'] as const;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
    else if (typeof value === 'number') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useSuppliers(params: { q?: string | undefined; status: 'active' | 'inactive' | 'all' }) {
  return useQuery({
    queryKey: [...KEY, 'suppliers', params],
    queryFn: () => apiRequest<SupplierPage>(`/api/v1/purchasing/suppliers${query(params)}`),
  });
}

export function useCreateSupplier() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateSupplierRequest; idempotencyKey: string }) =>
      apiRequest<{ data: SupplierView }>('/api/v1/purchasing/suppliers', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSupplier() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ supplier, input }: { supplier: SupplierView; input: UpdateSupplierRequest }) =>
      apiRequest<{ data: SupplierView }>(`/api/v1/purchasing/suppliers/${supplier.id}`, {
        method: 'PATCH',
        body: input,
        ifMatch: `"v${String(supplier.version)}"`,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePurchases(params: {
  status?: PurchaseStatus | undefined;
  supplierId?: string | undefined;
  q?: string | undefined;
  limit?: number | undefined;
}) {
  return useQuery({
    queryKey: [...KEY, 'purchases', params],
    queryFn: () => apiRequest<PurchasePage>(`/api/v1/purchasing/purchases${query(params)}`),
  });
}

export function usePurchase(id: string) {
  return useQuery({
    queryKey: [...KEY, 'purchase', id],
    queryFn: () =>
      apiRequest<{ data: PurchaseDetail }>(`/api/v1/purchasing/purchases/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreatePurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreatePurchaseRequest; idempotencyKey: string }) =>
      apiRequest<{ data: PurchaseDetail }>('/api/v1/purchasing/purchases', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReceivePurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      purchaseId,
      input,
      idempotencyKey,
    }: {
      purchaseId: string;
      input: ReceivePurchaseRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: PurchaseDetail }>(`/api/v1/purchasing/purchases/${purchaseId}/receipts`, {
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
