import { ROLE_NAMES, RoleCode, type MeResponse, type UserSummary } from '@quatreros/contracts';
import { useState, type SubmitEvent } from 'react';
import { newIdempotencyKey, type ApiError } from '../../shared/api/client';
import { Alert, Button, CheckboxGroup, TextField } from '../../shared/ui/form';
import { useCreateUser, useSetActive, useSites, useUpdateUser, useUsers } from './api';

const roleOptions = RoleCode.options.map((code) => ({ value: code, label: ROLE_NAMES[code] }));

type Editing = { mode: 'create' } | { mode: 'edit'; user: UserSummary } | null;

/** Usuarios (RF-003): lista, creación, edición de roles y sedes, desactivación. Solo Administrador. */
export function UsersPage({ me }: { me: MeResponse }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const users = useUsers(q);
  const setActive = useSetActive();
  const canCreate = 'adm.user.create' in me.permissions;
  const canUpdate = 'adm.user.update' in me.permissions;

  return (
    <section aria-labelledby="usuarios-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="usuarios-titulo" className="text-2xl font-bold">
          Usuarios
        </h1>
        {canCreate && !editing ? (
          <Button
            onClick={() => {
              setNotice(null);
              setEditing({ mode: 'create' });
            }}
          >
            Crear usuario
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div className="mt-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      ) : null}

      {editing ? (
        <UserForm
          key={editing.mode === 'edit' ? editing.user.id : 'new'}
          editing={editing}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
          onCancel={() => {
            setEditing(null);
          }}
        />
      ) : null}

      <div className="mt-6 max-w-sm">
        <TextField
          label="Buscar por nombre o correo"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
      </div>

      {users.isPending ? <p className="mt-6 text-ink-muted">Cargando usuarios…</p> : null}
      {users.error ? (
        <div className="mt-6">
          <Alert>{users.error.message}</Alert>
        </div>
      ) : null}
      {users.data?.length === 0 ? (
        <p className="mt-6 text-ink-muted">
          {q ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay usuarios.'}
        </p>
      ) : null}

      {users.data && users.data.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-panel border border-line bg-panel">
          <table className="w-full min-w-[44rem] text-left">
            <thead className="border-b border-line text-sm text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Persona</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Sedes</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{u.fullName}</span>
                    <span className="text-sm text-ink-muted">{u.email}</span>
                  </td>
                  <td className="px-4 py-3">{u.roles.map((r) => ROLE_NAMES[r]).join(', ')}</td>
                  <td className="px-4 py-3">{u.sites.map((s) => s.name).join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 text-sm ${u.isActive ? 'bg-chimichurri-soft text-chimichurri-strong' : 'bg-surface text-ink-muted ring-1 ring-line'}`}
                    >
                      {u.isActive ? 'Activo' : 'Desactivado'}
                    </span>
                    {u.mfaEnabled ? (
                      <span className="ml-2 text-sm whitespace-nowrap text-ink-muted">Dos pasos</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canUpdate ? (
                      <>
                        <Button
                          variant="secondary"
                          className="mr-2"
                          onClick={() => {
                            setNotice(null);
                            setEditing({ mode: 'edit', user: u });
                          }}
                        >
                          Editar
                        </Button>
                        {u.id !== me.user.id ? (
                          <Button
                            variant={u.isActive ? 'danger' : 'secondary'}
                            disabled={setActive.isPending}
                            onClick={() => {
                              const action = u.isActive ? 'Desactivar' : 'Reactivar';
                              if (!window.confirm(`${action} a ${u.fullName}?`)) return;
                              setActive.mutate(
                                { user: u, active: !u.isActive },
                                {
                                  onSuccess: () => {
                                    setNotice(
                                      `${u.fullName} quedó ${u.isActive ? 'desactivado' : 'activo'}.`,
                                    );
                                  },
                                  onError: (err) => {
                                    setNotice(err.message);
                                  },
                                },
                              );
                            }}
                          >
                            {u.isActive ? 'Desactivar' : 'Reactivar'}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function UserForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: NonNullable<Editing>;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const existing = editing.mode === 'edit' ? editing.user : null;
  const sites = useSites();
  const create = useCreateUser();
  const update = useUpdateUser();
  // Una clave por intento de creación: reintentos no duplican (BR-007).
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [roleCodes, setRoleCodes] = useState<RoleCode[]>(existing?.roles ?? []);
  const [siteIds, setSiteIds] = useState<string[]>(existing?.sites.map((s) => s.id) ?? []);
  const error = (create.error ?? update.error) as ApiError | null;
  const busy = create.isPending || update.isPending;

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (existing) {
      update.mutate(
        { user: existing, input: { fullName, roleCodes, siteIds } },
        {
          onSuccess: () => {
            onDone(`Cambios guardados para ${fullName}.`);
          },
        },
      );
    } else {
      create.mutate(
        { input: { fullName, email, temporaryPassword, roleCodes, siteIds }, idempotencyKey },
        {
          onSuccess: (res) => {
            onDone(`${res.data.fullName} ya puede ingresar con su correo y la contraseña temporal.`);
          },
        },
      );
    }
  };

  return (
    <form
      className="mt-6 flex max-w-2xl flex-col gap-4 rounded-panel border border-line bg-panel p-5"
      onSubmit={submit}
      aria-label={existing ? `Editar a ${existing.fullName}` : 'Crear usuario'}
    >
      <h2 className="text-xl font-bold">{existing ? `Editar a ${existing.fullName}` : 'Nuevo usuario'}</h2>
      {error && !error.problem.errors ? <Alert>{error.message}</Alert> : null}
      <TextField
        label="Nombre completo"
        required
        value={fullName}
        error={error?.fieldError('fullName')}
        onChange={(e) => {
          setFullName(e.target.value);
        }}
      />
      {!existing ? (
        <>
          <TextField
            label="Correo"
            type="email"
            required
            value={email}
            error={error?.fieldError('email')}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          <TextField
            label="Contraseña temporal"
            type="text"
            autoComplete="new-password"
            required
            minLength={12}
            hint="Mínimo 12 caracteres. Entrégala a la persona por un medio seguro."
            value={temporaryPassword}
            error={error?.fieldError('temporaryPassword')}
            onChange={(e) => {
              setTemporaryPassword(e.target.value);
            }}
          />
        </>
      ) : null}
      <CheckboxGroup
        legend="Roles"
        options={roleOptions}
        value={roleCodes}
        onChange={setRoleCodes}
        error={error?.fieldError('roleCodes')}
      />
      {sites.data ? (
        <CheckboxGroup
          legend="Sedes"
          options={sites.data.map((s) => ({
            value: s.id,
            label: s.name,
            detail: s.kind === 'warehouse' ? 'Bodega' : 'Punto de venta',
          }))}
          value={siteIds}
          onChange={setSiteIds}
        />
      ) : (
        <p className="text-ink-muted">Cargando sedes…</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : existing ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
