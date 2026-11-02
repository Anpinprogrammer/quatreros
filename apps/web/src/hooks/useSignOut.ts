import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../services/auth-client';

export function useSignOut() {
  const client = useQueryClient();
  return async () => {
    await authClient.signOut();
    client.clear();
    window.location.assign('/ingresar');
  };
}
