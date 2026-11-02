import type { HealthResponse } from '@quatreros/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../services/client';

/** Indicador de conexión con el servidor (deployment-design §5: visible en POS y portal). */
export function ServerStatus({ compact = false }: { compact?: boolean }) {
  const { data, isError, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiRequest<HealthResponse>('/health'),
    refetchInterval: 30_000,
    retry: 1,
  });

  const state = isPending ? 'checking' : isError ? 'offline' : 'online';
  const text = { checking: 'Verificando conexión', offline: 'Sin conexión', online: 'Conectado' }[state];
  const dot = { checking: 'bg-ink-3', offline: 'bg-danger', online: 'bg-success' }[state];

  return (
    <p
      role="status"
      title={text}
      className={`flex items-center gap-2 text-caption whitespace-nowrap text-ink-2 ${compact ? 'justify-center' : ''}`}
    >
      <span aria-hidden className={`inline-block size-2 rounded-full ${dot}`} />
      <span className={compact ? 'sr-only' : ''}>{text}</span>
      {data ? <span className="sr-only">versión {data.version}</span> : null}
    </p>
  );
}
