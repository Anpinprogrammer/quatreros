import type { MeResponse } from '@quatreros/contracts';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '../services/client';

export const ME_KEY = ['me'] as const;

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: 'disabled' | 'not_provisioned' | 'expired' }
  | { status: 'authenticated'; me: MeResponse };

/** Usuario actual. `null` = sin sesión. */
export function useSession(): SessionState {
  const query = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await apiRequest<MeResponse>('/api/v1/me');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ACCOUNT_DISABLED')
          return { anonymous: 'disabled' as const };
        if (err instanceof ApiError && err.code === 'SESSION_EXPIRED')
          return { anonymous: 'expired' as const };
        if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_PROVISIONED')
          return { anonymous: 'not_provisioned' as const };
        if (err instanceof ApiError && err.status === 401) return { anonymous: undefined };
        throw err;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
  if (query.isPending) return { status: 'loading' };
  const data = query.data;
  if (!data || 'anonymous' in data) {
    return data?.anonymous ? { status: 'anonymous', reason: data.anonymous } : { status: 'anonymous' };
  }
  return { status: 'authenticated', me: data };
}
