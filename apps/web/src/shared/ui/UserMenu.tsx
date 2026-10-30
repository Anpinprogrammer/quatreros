import type { MeResponse } from '@quatreros/contracts';
import { useSignOut } from '../auth/session';
import { Button } from './form';

/** Identidad del usuario y cierre de sesión, presente en los tres shells. */
export function UserMenu({ me, compact = false }: { me: MeResponse; compact?: boolean }) {
  const signOut = useSignOut();
  return (
    <div className="ml-auto flex items-center gap-3">
      <p className={compact ? 'sr-only' : 'text-right'}>
        <span className="block text-body font-semibold">{me.user.fullName}</span>
        <span className="text-caption text-ash">{me.roles.map((r) => r.name).join(', ')}</span>
      </p>
      <Button variant="secondary" onClick={() => void signOut()}>
        Salir
      </Button>
    </div>
  );
}
