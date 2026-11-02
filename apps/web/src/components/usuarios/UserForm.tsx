import { ROLE_NAMES, RoleCode, type UserSummary } from '@quatreros/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { generateTemporaryPassword } from '../../lib/password';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { useCreateUser, useSites, useUpdateUser } from '../../services/usuarios';
import { Alert, Button, CheckboxGroup, TextField } from '../ui/form';

export type Editing = { mode: 'create' } | { mode: 'edit'; user: UserSummary } | null;

const roleOptions = RoleCode.options.map((code) => ({ value: code, label: ROLE_NAMES[code] }));

export function UserForm({
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
