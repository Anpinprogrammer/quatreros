import type { MeResponse } from '@quatreros/contracts';
import { LogOut } from 'lucide-react';
import { useSignOut } from '../auth/session';

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Identidad del usuario y cierre de sesión, presente en los tres shells. */
export function UserMenu({
  me,
  compact = false,
  showName = false,
}: {
  me: MeResponse;
  compact?: boolean;
  showName?: boolean;
}) {
  const signOut = useSignOut();
  return (
    <div className="flex items-center gap-2">
      {!compact ? (
        <div className={`text-right ${showName ? '' : 'hidden sm:block'}`}>
          <p className="max-w-28 truncate text-caption font-semibold text-ink sm:max-w-40 sm:text-body">
            {me.user.fullName}
          </p>
          <p className="hidden max-w-40 truncate text-caption text-ink-2 sm:block">
            {me.roles.map((r) => r.name).join(', ')}
          </p>
        </div>
      ) : null}
      <span
        aria-hidden
        title={me.user.fullName}
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 text-caption font-bold text-ink"
      >
        {initials(me.user.fullName)}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label="Salir"
        title="Cerrar sesión"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-body font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <LogOut aria-hidden className="size-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  );
}
