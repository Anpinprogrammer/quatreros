import { ROLE_NAMES, RoleCode, type MeResponse, type UserSummary } from '@quatreros/contracts';
import { Users } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button, CheckboxGroup, TextField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useCreateUser, useSetActive, useSites, useUpdateUser, useUsers } from '../../services/usuarios';
import { generateTemporaryPassword } from '../../lib/password';

const roleOptions = RoleCode.options.map((code) => ({ value: code, label: ROLE_NAMES[code] }));

type Editing = { mode: 'create' } | { mode: 'edit'; user: UserSummary } | null;

/** Usuarios (RF-003): lista, creación, edición de roles y sedes, desactivación. Solo Administrador. */
export function UsersPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Usuarios');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<UserSummary | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toast = useToast();
  const users = useUsers(q);
  const setActive = useSetActive();
  const canCreate = 'adm.user.create' in me.permissions;
  const canUpdate = 'adm.user.update' in me.permissions;

  // Al cerrar el formulario, el foco vuelve al título para no perderse en el documento.
  const closeForm = (message?: string) => {
    setEditing(null);
    if (message) toast.show(message);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const deactivating = confirming?.isActive ?? true;
  const confirmAction = deactivating ? 'desactivación' : 'reactivación';

  return (
    <section aria-labelledby="usuarios-titulo" className="space-y-6">
      <PageHeader
        titleId="usuarios-titulo"
        titleRef={headingRef}
        eyebrow={
          <Link to="/erp/seccion/administracion" className="hover:text-ink">
            Administración · Usuarios
          </Link>
        }
        title="Usuarios"
        description="Personas con acceso a la plataforma, su rol, sus sedes y el estado de su cuenta. Los cambios quedan auditados."
        actions={
          canCreate && !editing ? (
            <Button
              onClick={() => {
                setNotice(null);
                setEditing({ mode: 'create' });
              }}
            >
              Crear usuario
            </Button>
          ) : null
        }
        meta={
          users.data ? (
            <Badge tone="neutral">
              {users.data.length} {users.data.length === 1 ? 'persona' : 'personas'}
            </Badge>
          ) : null
        }
      />

      {notice ? <Alert tone={notice.tone === 'info' ? 'success' : 'error'}>{notice.text}</Alert> : null}

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

      <div className="max-w-md">
        <SearchInput
          label="Buscar por nombre o correo"
          placeholder="Nombre o correo"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
      </div>

      {users.isPending ? <LoadingSkeleton label="Cargando usuarios…" rows={1} /> : null}
      {users.error ? <Alert>{users.error.message}</Alert> : null}
      {users.data?.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title={q ? 'Nadie coincide con la búsqueda' : 'Todavía no hay usuarios'}
          description={
            q ? 'Prueba con otro nombre o correo.' : 'Crea la primera cuenta para que alguien pueda ingresar.'
          }
        />
      ) : null}

      {users.data && users.data.length > 0 ? (
        <DataTable>
          <caption className="sr-only">Usuarios del sistema, con su rol, sedes y estado</caption>
          <thead className="border-b border-line bg-surface-2/70 text-caption tracking-[0.08em] text-ink-2 uppercase">
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
          <tbody className="divide-y divide-line">
            {users.data.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-surface-2/50">
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block font-semibold text-ink">{u.fullName}</span>
                  <span className="text-caption text-ink-2">{u.email}</span>
                </th>
                <td className="px-4 py-3 text-ink">{u.roles.map((r) => ROLE_NAMES[r]).join(', ')}</td>
                <td className="px-4 py-3 text-ink-2">{u.sites.map((s) => s.name).join(', ') || '—'}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={u.isActive ? 'success' : 'neutral'}>
                      {u.isActive ? 'Activo' : 'Desactivado'}
                    </Badge>
                    {u.mfaEnabled ? <Badge tone="info">Dos pasos</Badge> : null}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canUpdate ? (
                    <div className="flex flex-wrap justify-end gap-1">
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
                          variant="ghost"
                          aria-label={`${u.isActive ? 'Desactivar' : 'Reactivar'} a ${u.fullName}`}
                          onClick={() => {
                            setNotice(null);
                            setConfirming(u);
                          }}
                        >
                          {u.isActive ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={deactivating ? 'Desactivar cuenta' : 'Reactivar cuenta'}
        description={
          confirming ? (
            <>
              {deactivating
                ? `${confirming.fullName} dejará de poder ingresar y se cerrarán sus sesiones.`
                : `${confirming.fullName} podrá volver a ingresar con sus credenciales actuales.`}
            </>
          ) : null
        }
        confirmLabel={deactivating ? 'Sí, desactivar' : 'Sí, reactivar'}
        groupLabel={`Confirmar ${confirmAction}`}
        tone={deactivating ? 'danger' : 'primary'}
        busy={setActive.isPending}
        onCancel={() => {
          setConfirming(null);
        }}
        onConfirm={() => {
          if (!confirming) return;
          const user = confirming;
          setActive.mutate(
            { user, active: !user.isActive },
            {
              onSuccess: () => {
                toast.show(`${user.fullName} quedó ${user.isActive ? 'desactivado' : 'activo'}.`);
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
      className="flex max-w-2xl flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      aria-label={existing ? `Editar a ${existing.fullName}` : 'Crear usuario'}
    >
      <div>
        <p className="text-caption font-semibold tracking-[0.1em] text-ink-3 uppercase">
          {existing ? 'Editar cuenta' : 'Nueva cuenta'}
        </p>
        <h2
          ref={titleRef}
          tabIndex={-1}
          className="mt-1 scroll-mt-4 font-display text-title font-bold text-ink outline-none"
        >
          {existing ? `Editar a ${existing.fullName}` : 'Nuevo usuario'}
        </h2>
      </div>
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
        <p className="text-ink-2">Cargando sedes…</p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : existing ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
