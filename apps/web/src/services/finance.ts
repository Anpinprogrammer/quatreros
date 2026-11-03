import type {
  AgingResponse,
  CollectionDetail,
  CollectionPage,
  CollectionStatus,
  CreatePaymentRequest,
  CreateReconciliationRequest,
  CustomerBalance,
  FinanceDashboard,
  FinancePaymentMethodView,
  ReceivablePage,
  ReconciliationPage,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

const KEY = ['finance'] as const;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
    else if (typeof value === 'number') search.set(key, String(value));
    else if (typeof value === 'boolean' && value) search.set(key, 'true');
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const invalidate = (client: ReturnType<typeof useQueryClient>) => client.invalidateQueries({ queryKey: KEY });

export function useAging(params: { siteId?: string | undefined; customerId?: string | undefined } = {}) {
  return useQuery({
    queryKey: [...KEY, 'aging', params],
    queryFn: () =>
      apiRequest<{ data: AgingResponse }>(`/api/v1/finance/receivables/aging${query(params)}`).then(
        (r) => r.data,
      ),
  });
}

export function useReceivables(
  params: {
    q?: string | undefined;
    customerId?: string | undefined;
    siteId?: string | undefined;
    status?: 'open' | 'partially_paid' | 'paid' | undefined;
    overdue?: boolean | undefined;
    limit?: number | undefined;
  } = {},
) {
  return useQuery({
    queryKey: [...KEY, 'receivables', params],
    queryFn: () => apiRequest<ReceivablePage>(`/api/v1/finance/receivables${query(params)}`),
  });
}

export function useCustomerBalance(customerId: string) {
  return useQuery({
    queryKey: [...KEY, 'customer-balance', customerId],
    queryFn: () =>
      apiRequest<{ data: CustomerBalance }>(`/api/v1/finance/receivables/customer/${customerId}`).then(
        (r) => r.data,
      ),
    enabled: Boolean(customerId),
  });
}

export function useCollections(
  params: {
    q?: string | undefined;
    status?: CollectionStatus | undefined;
    collectorType?: 'driver' | 'cash_register' | 'office' | undefined;
    collectorUserId?: string | undefined;
    customerId?: string | undefined;
    limit?: number | undefined;
  } = {},
) {
  return useQuery({
    queryKey: [...KEY, 'collections', params],
    queryFn: () => apiRequest<CollectionPage>(`/api/v1/finance/collections${query(params)}`),
  });
}

export function useReconciliations(params: { limit?: number | undefined } = {}) {
  return useQuery({
    queryKey: [...KEY, 'reconciliations', params],
    queryFn: () => apiRequest<ReconciliationPage>(`/api/v1/finance/reconciliations${query(params)}`),
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: [...KEY, 'payment-methods'],
    queryFn: () =>
      apiRequest<{ data: FinancePaymentMethodView[] }>('/api/v1/finance/payment-methods').then((r) => r.data),
  });
}

export function useCreatePayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreatePaymentRequest; idempotencyKey: string }) =>
      apiRequest<{ data: CollectionDetail }>('/api/v1/finance/collections', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useCreateReconciliation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateReconciliationRequest; idempotencyKey: string }) =>
      apiRequest('/api/v1/finance/reconciliations', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => invalidate(client),
  });
}

export function useFinanceDashboard() {
  return useQuery({
    queryKey: [...KEY, 'dashboard'],
    queryFn: () => apiRequest<{ data: FinanceDashboard }>('/api/v1/finance/dashboard').then((r) => r.data),
  });
}

export async function downloadReport(
  path: string,
  filename: string,
  params: Record<string, string | undefined> = {},
): Promise<void> {
  const response = await fetch(`/api/v1${path}${query(params)}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('No fue posible generar el reporte.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
