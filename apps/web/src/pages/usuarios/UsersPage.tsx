import { ROLE_NAMES, type MeResponse, type UserSummary } from '@quatreros/contracts';
import { Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { useToast } from '../../components/ui/Toast';
import { UserForm, type Editing } from '../../components/usuarios/UserForm';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useSetActive, useUsers } from '../../services/usuarios';

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
