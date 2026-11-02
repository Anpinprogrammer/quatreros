import type {
  AvailabilityList,
  InventorySummary,
  LotDetail,
  LotPage,
  MovementPage,
  StockBalancePage,
  TraceabilityView,
} from '@quatreros/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../shared/api/client';

const INVENTORY_KEY = ['inventory'] as const;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
    else if (typeof value === 'number') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export interface BalanceParams {
  q?: string | undefined;
  productId?: string | undefined;
  rawMaterialId?: string | undefined;
  presentationId?: string | undefined;
  lotId?: string | undefined;
  locationId?: string | undefined;
  status?: string | undefined;
  expiresBefore?: string | undefined;
  limit?: number | undefined;
}

export function useInventorySummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'summary'],
    queryFn: () => apiRequest<{ data: InventorySummary }>('/api/v1/inventory/summary').then((r) => r.data),
    enabled: options?.enabled ?? true,
  });
}

export function useStockBalances(params: BalanceParams) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'balances', params],
    queryFn: () => apiRequest<StockBalancePage>(`/api/v1/inventory/stock-balances${query(params)}`),
  });
}

export function useAvailability(params: BalanceParams) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'availability', params],
    queryFn: () => apiRequest<AvailabilityList>(`/api/v1/inventory/availability${query(params)}`),
  });
}

export interface LotParams {
  q?: string | undefined;
  status?: string | undefined;
  expiresBefore?: string | undefined;
  productId?: string | undefined;
  rawMaterialId?: string | undefined;
  limit?: number | undefined;
}

export function useLots(params: LotParams) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'lots', params],
    queryFn: () => apiRequest<LotPage>(`/api/v1/inventory/lots${query(params)}`),
  });
}

export function useLot(id: string) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'lot', id],
    queryFn: () => apiRequest<{ data: LotDetail }>(`/api/v1/inventory/lots/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useTraceability(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'trace', id],
    queryFn: () =>
      apiRequest<{ data: TraceabilityView }>(`/api/v1/inventory/lots/${id}/traceability`).then((r) => r.data),
    enabled: enabled && Boolean(id),
  });
}

export interface MovementParams {
  q?: string | undefined;
  lotId?: string | undefined;
  locationId?: string | undefined;
  movementType?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
}

export function useMovements(params: MovementParams) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'movements', params],
    queryFn: () => apiRequest<MovementPage>(`/api/v1/inventory/movements${query(params)}`),
  });
}
