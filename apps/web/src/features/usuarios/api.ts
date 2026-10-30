import type { CreateUserRequest, SiteView, UpdateUserRequest, UserSummary } from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../shared/api/client';

const USERS_KEY = ['admin', 'users'] as const;

export function useUsers(q: string) {
  return useQuery({
    queryKey: [...USERS_KEY, q],
    queryFn: () =>
      apiRequest<{ data: UserSummary[] }>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`).then(
        (r) => r.data,
      ),
  });
}

export function useSites() {
  return useQuery({
    queryKey: ['admin', 'sites'],
    queryFn: () => apiRequest<{ data: SiteView[] }>('/api/v1/admin/sites').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateUserRequest; idempotencyKey: string }) =>
      apiRequest<{ data: UserSummary }>('/api/v1/admin/users', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ user, input }: { user: UserSummary; input: UpdateUserRequest }) =>
      apiRequest<{ data: UserSummary }>(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        body: input,
        ifMatch: `"v${String(user.version)}"`,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useSetActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ user, active }: { user: UserSummary; active: boolean }) =>
      apiRequest<{ data: UserSummary }>(
        `/api/v1/admin/users/${user.id}/${active ? 'reactivate' : 'deactivate'}`,
        {
          method: 'POST',
        },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
