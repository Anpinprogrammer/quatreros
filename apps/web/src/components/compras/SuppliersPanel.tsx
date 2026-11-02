import type { MeResponse, SupplierView } from '@quatreros/contracts';
import { Building2 } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { newIdempotencyKey, type ApiError } from '../../services/client';
import { hasPermission } from '../../hooks/session';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { Alert, Button, CheckboxField, TextField } from '../ui/form';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { useToast } from '../ui/Toast';
import { useCreateSupplier, useSuppliers, useUpdateSupplier } from '../../services/compras';

type Editing = { mode: 'create' } | { mode: 'edit'; supplier: SupplierView } | null;

/** Proveedores de la entrega 3 (RF-050). */
export function SuppliersPanel({ me }: { me: MeResponse }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const toast = useToast();
  const canManage = hasPermission(me, 'comp.supplier.manage');
  const suppliers = useSuppliers({ status: 'active' });

  const closeForm = (message?: string) => {
    setEditing(null);
    if (message) toast.show(message);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <section aria-labelledby="proveedores-titulo" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="proveedores-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-title font-bold text-ink outline-none"
          >
            Proveedores
          </h2>
          <p className="mt-1 text-body text-ink-2">
            Quién suministra la materia prima. No se eliminan: se inactivan.
          </p>
        </div>
        {canManage && !editing ? (
          <Button
            onClick={() => {
              setEditing({ mode: 'create' });
            }}
          >
            Nuevo proveedor
          </Button>
        ) : null}
      </div>

      {editing ? (
        <SupplierForm
          key={editing.mode === 'edit' ? editing.supplier.id : 'new'}
          {...(editing.mode === 'edit' ? { supplier: editing.supplier } : {})}
          onDone={closeForm}
          onCancel={() => {
            closeForm();
          }}
        />
      ) : null}

      {suppliers.isPending ? <LoadingSkeleton label="Cargando proveedores…" rows={2} /> : null}
      {suppliers.error ? <Alert>{suppliers.error.message}</Alert> : null}
      {suppliers.data && suppliers.data.data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Sin proveedores"
          description="Crea el primero para poder registrar compras."
          action={
            canManage ? (
              <Button
                onClick={() => {
                  setEditing({ mode: 'create' });
                }}
              >
                Crear proveedor
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {suppliers.data && suppliers.data.data.length > 0 ? (
        <DataTable minWidth="56rem" label="Proveedores">
          <caption className="sr-only">Proveedores activos</caption>
          <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">
                Proveedor
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Identificación
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Contacto
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Estado
              </th>
              {canManage ? (
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  Acciones
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {suppliers.data.data.map((supplier) => (
              <tr key={supplier.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3 font-semibold text-ink">{supplier.name}</td>
                <td className="px-3 py-3 font-mono text-ink-2">{supplier.taxId ?? '—'}</td>
                <td className="px-3 py-3 text-ink-2">
                  {supplier.contactName ?? '—'}
                  {supplier.phone ? (
                    <span className="block text-caption font-mono">{supplier.phone}</span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={supplier.isActive ? 'success' : 'neutral'}>
                    {supplier.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                {canManage ? (
                  <td className="px-3 py-3 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing({ mode: 'edit', supplier });
                      }}
                    >
                      Editar
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </section>
  );
}

function SupplierForm({
  supplier,
  onDone,
  onCancel,
}: {
  supplier?: SupplierView;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [name, setName] = useState(supplier?.name ?? '');
  const [taxId, setTaxId] = useState(supplier?.taxId ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [contactName, setContactName] = useState(supplier?.contactName ?? '');
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const error = (create.error ?? update.error) as ApiError | null;
  const busy = create.isPending || update.isPending;
  const taxIdTaken = error?.code === 'TAX_ID_TAKEN' ? error.message : undefined;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      name,
      taxId: taxId.trim() || null,
      phone: phone.trim() || null,
      contactName: contactName.trim() || null,
    };
    if (supplier) {
      update.mutate(
        { supplier, input: { ...input, isActive } },
        {
          onSuccess: () => {
            onDone(`Proveedor ${name} actualizado.`);
          },
        },
      );
      return;
    }
    create.mutate(
      { input, idempotencyKey },
      {
        onSuccess: () => {
          onDone(`Proveedor ${name} creado.`);
        },
      },
    );
  };

  return (
    <form
      className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      onSubmit={submit}
      aria-label={supplier ? `Editar ${supplier.name}` : 'Nuevo proveedor'}
    >
      <h3 ref={titleRef} tabIndex={-1} className="font-display text-title font-bold text-ink outline-none">
        {supplier ? `Editar ${supplier.name}` : 'Nuevo proveedor'}
      </h3>
      {error && !error.problem.errors && !taxIdTaken ? <Alert>{error.message}</Alert> : null}
      <TextField
        label="Nombre o razón social"
        required
        value={name}
        error={error?.fieldError('name')}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Identificación (NIT)"
          value={taxId}
          error={error?.fieldError('taxId') ?? taxIdTaken}
          onChange={(e) => {
            setTaxId(e.target.value);
          }}
        />
        <TextField
          label="Teléfono"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
          }}
        />
      </div>
      <TextField
        label="Contacto"
        value={contactName}
        onChange={(e) => {
          setContactName(e.target.value);
        }}
      />
      {supplier ? (
        <CheckboxField
          label="Proveedor activo"
          hint="Un proveedor inactivo no se puede usar en compras nuevas."
          checked={isActive}
          onChange={setIsActive}
        />
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : supplier ? 'Guardar cambios' : 'Crear proveedor'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
