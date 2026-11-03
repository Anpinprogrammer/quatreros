import type { EconomicEventListQuery, EconomicEventPage } from '@quatreros/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useEconomicEvents(params: Partial<EconomicEventListQuery> & { limit?: number } = {}) {
  return useQuery({
    queryKey: ['accounting', 'events', params],
    queryFn: () => apiRequest<EconomicEventPage>(`/api/v1/accounting/economic-events${query(params)}`),
  });
}
