import type { MeResponse } from '@quatreros/contracts';
import { useSignOut } from '../auth/session';
import { Button } from './form';

/** Identidad del usuario y cierre de sesión, presente en los tres shells. */
export function UserMenu({ me }: { me: MeResponse }) {
  const signOut = useSignOut();
  return (
    <div className="flex items-center gap-3">
      <p className="text-right text-sm leading-tight">
        <span className="block font-semibold">{me.user.fullName}</span>
        <span className="text-ink-muted">{me.roles.map((r) => r.name).join(', ')}</span>
      </p>
      <Button variant="secondary" className="px-3 text-sm" onClick={() => void signOut()}>
        Salir
      </Button>
    </div>
  );
}
