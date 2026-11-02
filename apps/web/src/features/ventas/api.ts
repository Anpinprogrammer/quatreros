import type {
  CreateCustomerRequest,
  CreateDispatchRequest,
  CreateSalesOrderRequest,
  CustomerPage,
  DeliveryRequest,
  DispatchDetail,
  DispatchPage,
  DispatchStatus,
  DriverView,
  InspectReturnRequest,
  ReturnRequest,
  SalesOrderDetail,
  SalesOrderPage,
  SalesOrderStatus,
  UpdateCreditRequest,
  UpdateCustomerRequest,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../shared/api/client';

const KEY = ['sales'] as const;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
    else if (typeof value === 'number') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useCustomers(
  params: { q?: string | undefined; status?: 'active' | 'inactive' | 'all' } = {},
) {
  return useQuery({
    queryKey: [...KEY, 'customers', params],
    queryFn: () => apiRequest<CustomerPage>(`/api/v1/sales/customers${query(params)}`),
  });
}

export function useCreateCustomer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateCustomerRequest; idempotencyKey: string }) =>
      apiRequest('/api/v1/sales/customers', { method: 'POST', body: input, idempotencyKey }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCustomer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, input }: { id: string; version: number; input: UpdateCustomerRequest }) =>
      apiRequest(`/api/v1/sales/customers/${id}`, {
        method: 'PATCH',
        body: input,
        ifMatch: `"v${String(version)}"`,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCredit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCreditRequest }) =>
      apiRequest(`/api/v1/sales/customers/${id}/credit`, { method: 'PUT', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useOrders(
  params: {
    status?: SalesOrderStatus | undefined;
    q?: string | undefined;
    limit?: number | undefined;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...KEY, 'orders', params],
    queryFn: () => apiRequest<SalesOrderPage>(`/api/v1/sales/orders${query(params)}`),
    enabled: options?.enabled ?? true,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: [...KEY, 'order', id],
    queryFn: () => apiRequest<{ data: SalesOrderDetail }>(`/api/v1/sales/orders/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateSalesOrderRequest; idempotencyKey: string }) =>
      apiRequest<{ data: SalesOrderDetail }>('/api/v1/sales/orders', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDrivers() {
  return useQuery({
    queryKey: [...KEY, 'drivers'],
    queryFn: () => apiRequest<{ data: DriverView[] }>('/api/v1/distribution/drivers').then((r) => r.data),
  });
}

export function useDispatches(
  params: { status?: DispatchStatus | undefined; limit?: number | undefined } = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...KEY, 'dispatches', params],
    queryFn: () => apiRequest<DispatchPage>(`/api/v1/distribution/dispatches${query(params)}`),
    enabled: options?.enabled ?? true,
  });
}

export function useDispatch(id: string) {
  return useQuery({
    queryKey: [...KEY, 'dispatch', id],
    queryFn: () =>
      apiRequest<{ data: DispatchDetail }>(`/api/v1/distribution/dispatches/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreateDispatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateDispatchRequest; idempotencyKey: string }) =>
      apiRequest<{ data: DispatchDetail }>('/api/v1/distribution/dispatches', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLoadDispatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: DispatchDetail }>(`/api/v1/distribution/dispatches/${id}/load`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: KEY });
      void client.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeliver() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey,
    }: {
      id: string;
      input: DeliveryRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: DispatchDetail }>(`/api/v1/distribution/dispatches/${id}/deliveries`, {
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

export function useRegisterReturn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      idempotencyKey,
    }: {
      id: string;
      input: ReturnRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: DispatchDetail }>(`/api/v1/distribution/dispatches/${id}/returns`, {
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

export function useInspectReturn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ returnId, input }: { returnId: string; input: InspectReturnRequest }) =>
      apiRequest(`/api/v1/distribution/returns/${returnId}/inspect`, {
        method: 'POST',
        body: input,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: KEY });
      void client.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
