import type { HealthResponse } from '@quatreros/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

/** Indicador de conexión con el servidor (deployment-design §5: visible en POS y portal). */
export function ServerStatus() {
  const { data, isError, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiRequest<HealthResponse>('/health'),
    refetchInterval: 30_000,
    retry: 1,
  });

  const state = isPending ? 'checking' : isError ? 'offline' : 'online';
  const text = { checking: 'Verificando conexión', offline: 'Sin conexión', online: 'Conectado' }[state];
  const dot = { checking: 'bg-ash', offline: 'bg-danger', online: 'bg-success' }[state];

  return (
    <p role="status" className="flex items-center gap-2 text-caption whitespace-nowrap text-ash">
      <span aria-hidden className={`inline-block size-2.5 rounded-full ${dot}`} />
      {text}
      {data ? <span className="sr-only">versión {data.version}</span> : null}
    </p>
  );
}
