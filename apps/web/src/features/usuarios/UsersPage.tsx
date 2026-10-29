import { ROLE_NAMES, RoleCode, type MeResponse, type UserSummary } from '@quatreros/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { newIdempotencyKey, type ApiError } from '../../shared/api/client';
import { Alert, Button, CheckboxGroup, TextField } from '../../shared/ui/form';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { useCreateUser, useSetActive, useSites, useUpdateUser, useUsers } from './api';
import { generateTemporaryPassword } from './password';

const roleOptions = RoleCode.options.map((code) => ({ value: code, label: ROLE_NAMES[code] }));

type Editing = { mode: 'create' } | { mode: 'edit'; user: UserSummary } | null;

/** Usuarios (RF-003): lista, creación, edición de roles y sedes, desactivación. Solo Administrador. */
export function UsersPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Usuarios');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const users = useUsers(q);
  const setActive = useSetActive();
  const canCreate = 'adm.user.create' in me.permissions;
  const canUpdate = 'adm.user.update' in me.permissions;

  // Al cerrar el formulario, el foco vuelve al título para no perderse en el documento.
  const closeForm = (message?: string) => {
    setEditing(null);
    if (message) setNotice({ tone: 'info', text: message });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <section aria-labelledby="usuarios-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="usuarios-titulo" ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
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
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      ) : null}

      {editing ? (
        <UserForm
          key={editing.mode === 'edit' ? editing.user.id : 'new'}
          editing={editing}
          onDone={closeForm}
          onCancel={() => {
            closeForm();
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
            <caption className="sr-only">Usuarios del sistema, con su rol, sedes y estado</caption>
            <thead className="border-b border-line text-sm text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Persona
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Rol
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Sedes
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 font-normal">
                    <span className="block font-semibold">{u.fullName}</span>
                    <span className="text-sm text-ink-muted">{u.email}</span>
                  </th>
                  <td className="px-4 py-3">{u.roles.map((r) => ROLE_NAMES[r]).join(', ')}</td>
                  <td className="px-4 py-3">{u.sites.map((s) => s.name).join(', ') || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`rounded-control px-1.5 text-sm ${u.isActive ? 'bg-chimichurri-soft text-chimichurri-strong' : 'bg-surface text-ink-muted ring-1 ring-control'}`}
                    >
                      {u.isActive ? 'Activo' : 'Desactivado'}
                    </span>
                    {u.mfaEnabled ? <span className="ml-2 text-sm text-ink-muted">Dos pasos</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canUpdate && confirming === u.id ? (
                      <ConfirmToggle
                        user={u}
                        busy={setActive.isPending}
                        onCancel={() => {
                          setConfirming(null);
                        }}
                        onConfirm={() => {
                          setActive.mutate(
                            { user: u, active: !u.isActive },
                            {
                              onSuccess: () => {
                                setNotice({
                                  tone: 'info',
                                  text: `${u.fullName} quedó ${u.isActive ? 'desactivado' : 'activo'}.`,
                                });
                              },
                              onError: (err) => {
                                setNotice({ tone: 'error', text: err.message });
                              },
                              onSettled: () => {
                                setConfirming(null);
                              },
                            },
                          );
                        }}
                      />
                    ) : canUpdate ? (
                      <>
                        <Button
                          variant="secondary"
                          aria-label={`Editar a ${u.fullName}`}
                          onClick={() => {
                            setNotice(null);
                            setEditing({ mode: 'edit', user: u });
                          }}
                        >
                          Editar
                        </Button>
                        {u.id !== me.user.id ? (
                          <Button
                            variant="quiet"
                            className="ml-1"
                            aria-label={`${u.isActive ? 'Desactivar' : 'Reactivar'} a ${u.fullName}`}
                            onClick={() => {
                              setNotice(null);
                              setConfirming(u.id);
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

/** Confirmación dentro de la fila (sin diálogos del navegador): dice qué pasará y enfoca "No". */
function ConfirmToggle({
  user,
  busy,
  onConfirm,
  onCancel,
}: {
  user: UserSummary;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  const deactivating = user.isActive;
  return (
    <div
      role="group"
      aria-label={`Confirmar ${deactivating ? 'desactivación' : 'reactivación'}`}
      className="inline-flex flex-col items-end gap-2 text-left whitespace-normal"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <p className="max-w-60 text-sm">
        {deactivating
          ? `¿Desactivar a ${user.fullName}? Se cerrarán sus sesiones y no podrá ingresar.`
          : `¿Reactivar a ${user.fullName}? Podrá volver a ingresar.`}
      </p>
      <div className="flex gap-2">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          No
        </Button>
        <Button variant={deactivating ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
          {busy ? 'Guardando…' : deactivating ? 'Sí, desactivar' : 'Sí, reactivar'}
        </Button>
      </div>
    </div>
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
  const titleRef = useRef<HTMLHeadingElement>(null);
  const error = (create.error ?? update.error) as ApiError | null;
  const busy = create.isPending || update.isPending;
  const emailTaken = error?.code === 'EMAIL_TAKEN' ? error.message : undefined;

  const formRef = useRef<HTMLFormElement>(null);

  // El formulario aparece arriba de la tabla: se lleva el foco y la vista hasta él.
  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  // Tras un error del servidor, el foco va al primer campo marcado (su mensaje se lee con él).
  useEffect(() => {
    if (!error) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = invalid?.matches('fieldset') ? invalid.querySelector('input') : invalid;
    target?.focus();
  }, [error]);

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
      ref={formRef}
      className="mt-6 flex max-w-2xl flex-col gap-4 rounded-panel border border-line bg-panel p-5"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      aria-label={existing ? `Editar a ${existing.fullName}` : 'Crear usuario'}
    >
      <h2 ref={titleRef} tabIndex={-1} className="scroll-mt-4 text-xl font-bold outline-none">
        {existing ? `Editar a ${existing.fullName}` : 'Nuevo usuario'}
      </h2>
      {error && !error.problem.errors && !emailTaken ? <Alert>{error.message}</Alert> : null}
      <TextField
        label="Nombre completo"
        required
        autoComplete="off"
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
            autoComplete="off"
            value={email}
            error={error?.fieldError('email') ?? emailTaken}
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
            spellCheck={false}
            className="font-mono"
            hint="Mínimo 12 caracteres. Entrégala a la persona por un medio seguro."
            value={temporaryPassword}
            error={error?.fieldError('temporaryPassword')}
            onChange={(e) => {
              setTemporaryPassword(e.target.value);
            }}
            addon={
              <Button
                variant="secondary"
                onClick={() => {
                  setTemporaryPassword(generateTemporaryPassword());
                }}
              >
                Generar
              </Button>
            }
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
          error={error?.fieldError('siteIds')}
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
