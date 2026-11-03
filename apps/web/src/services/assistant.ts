import type {
  AssistantSettings,
  AssistantStatus,
  AssistantStreamEvent,
  AssistantUsage,
  ConfirmProposalResponse,
  CreateTicketRequest,
  TicketPage,
  TicketView,
  UpdateAssistantSettingsRequest,
} from '@quatreros/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

const KEY = ['assistant'] as const;

export function useAssistantStatus() {
  return useQuery({
    queryKey: [...KEY, 'status'],
    queryFn: () => apiRequest<{ data: AssistantStatus }>('/api/v1/assistant/status').then((r) => r.data),
    retry: false,
  });
}

export function useTickets() {
  return useQuery({
    queryKey: [...KEY, 'tickets'],
    queryFn: () => apiRequest<TicketPage>('/api/v1/assistant/tickets?limit=50'),
  });
}

export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateTicketRequest; idempotencyKey: string }) =>
      apiRequest<{ data: TicketView }>('/api/v1/assistant/tickets', {
        method: 'POST',
        body: input,
        idempotencyKey,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: ({
      ticketId,
      text,
      idempotencyKey,
    }: {
      ticketId: string;
      text: string;
      idempotencyKey: string;
    }) =>
      apiRequest<{ data: { turnId: string } }>(`/api/v1/assistant/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { text },
        idempotencyKey,
      }),
  });
}

export function useConfirmProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      apiRequest<{ data: ConfirmProposalResponse }>(`/api/v1/assistant/proposals/${proposalId}/confirm`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      apiRequest<{ data: { status: 'cancelled' } }>(`/api/v1/assistant/proposals/${proposalId}/cancel`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAssistantSettings() {
  return useQuery({
    queryKey: [...KEY, 'settings'],
    queryFn: () => apiRequest<{ data: AssistantSettings }>('/api/v1/assistant/settings').then((r) => r.data),
    retry: false,
  });
}

export function useUpdateAssistantSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAssistantSettingsRequest) =>
      apiRequest<{ data: AssistantSettings }>('/api/v1/assistant/settings', {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAssistantUsage(params: { from?: string; to?: string } = {}) {
  const search = new URLSearchParams();
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  return useQuery({
    queryKey: [...KEY, 'usage', params],
    queryFn: () =>
      apiRequest<{ data: AssistantUsage }>(
        `/api/v1/assistant/usage?limit=100${search.size ? `&${search.toString()}` : ''}`,
      ).then((r) => r.data),
  });
}

export function streamAssistant(
  ticketId: string,
  onEvent: (event: AssistantStreamEvent) => void,
  onError?: (error: Event) => void,
): () => void {
  const source = new EventSource(`/api/v1/assistant/tickets/${ticketId}/stream`);
  source.onmessage = (message) => {
    try {
      const raw = message.data as unknown;
      if (typeof raw !== 'string') return;
      const parsed = JSON.parse(raw) as AssistantStreamEvent;
      onEvent(parsed);
    } catch {
      // Un evento malformado no debe romper la conversación.
    }
  };
  source.onerror = (error: Event) => {
    onError?.(error);
  };
  return () => {
    source.close();
  };
}
