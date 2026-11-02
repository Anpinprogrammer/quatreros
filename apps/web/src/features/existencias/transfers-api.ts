import type {
  CreateTransferRequest,
  ReceiveTransferRequest,
  TransferDetail,
  TransferPage,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../shared/api/client';

const KEY = ['inventory', 'transfers'] as const;

export interface TransferListParams {
  status?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
}

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
    else if (typeof value === 'number') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useTransfers(params: TransferListParams = {}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => apiRequest<TransferPage>(`/api/v1/inventory/transfers${query(params)}`),
  });
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () =>
      apiRequest<{ data: TransferDetail }>(`/api/v1/inventory/transfers/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useCreateTransfer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateTransferRequest; idempotencyKey: string }) =>
      apiRequest<{ data: TransferDetail }>('/api/v1/inventory/transfers', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReceiveTransfer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      transferId,
      input,
      idempotencyKey,
    }: {
      transferId: string;
      input: ReceiveTransferRequest;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: TransferDetail }>(`/api/v1/inventory/transfers/${transferId}/receive`, {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
