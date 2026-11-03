import type { AssistantSettings, MeResponse } from '@quatreros/contracts';
import { Bot, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardLabel } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert, Button, CheckboxField, TextField } from '../../components/ui/form';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMoney } from '../../lib/format/pos';
import { hasPermission } from '../../lib/session';
import {
  useAssistantSettings,
  useAssistantUsage,
  useTickets,
  useUpdateAssistantSettings,
} from '../../services/assistant';

type Tab = 'tickets' | 'consumo' | 'configuracion';

function cents(value: number): string {
  return formatMoney((value / 100).toFixed(2));
}

/** Tickets, consumo y configuración del asistente (DEC-106). */
export function AssistantPage({ me }: { me: MeResponse }) {
  useDocumentTitle('Asistente de IA');
  const [tab, setTab] = useState<Tab>('tickets');
  const tickets = useTickets();
  const canManage = hasPermission(me, 'adm.addon.toggle');
  const canSeeUsage = hasPermission(me, 'ia.usage.read');
  const settings = useAssistantSettings();
  const usage = useAssistantUsage();

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'tickets', label: 'Tickets', visible: true },
    { id: 'consumo', label: 'Consumo', visible: canSeeUsage },
    { id: 'configuracion', label: 'Configuración', visible: canManage },
  ];

  return (
    <section aria-labelledby="asistente-titulo" className="space-y-6">
      <PageHeader
        titleId="asistente-titulo"
        eyebrow="Sistema · Actividad de IA"
        title="Asistente de IA"
        description="Consultas en lenguaje natural, preparación de materias primas y recetas, tickets y consumo del agente."
        meta={
          settings.data ? (
            <Badge tone={settings.data.enabled ? 'success' : 'neutral'}>
              {settings.data.enabled ? 'Activo' : 'Apagado'}
            </Badge>
          ) : null
        }
      />

      <div
        className="flex gap-1 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label="Vistas del asistente"
      >
        {tabs
          .filter((item) => item.visible)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => {
                setTab(item.id);
              }}
              className={`-mb-px min-h-12 shrink-0 rounded-t-lg border-b-2 px-4 text-body font-semibold ${
                tab === item.id ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
      </div>

      {tab === 'tickets' ? (
        <Card>
          <CardLabel>Tus tickets</CardLabel>
          {tickets.isPending ? <LoadingSkeleton label="Cargando tickets…" rows={3} /> : null}
          {tickets.error ? <Alert tone="error">{tickets.error.message}</Alert> : null}
          {tickets.data?.data.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="size-5" />}
              title="Todavía no hay tickets"
              description="Abre el asistente desde la burbuja y haz tu primera consulta."
            />
          ) : null}
          {tickets.data && tickets.data.data.length > 0 ? (
            <DataTable minWidth="60rem" label="Tickets del asistente">
              <thead className="border-b border-line bg-surface-2/60 text-caption text-ink-2 uppercase">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left">
                    Fecha
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Petición
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Resumen
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Herramientas
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Costo
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tickets.data.data.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-3 py-3 font-mono text-caption text-ink-2">
                      {formatDateTime(ticket.startedAt)}
                    </td>
                    <th scope="row" className="px-3 py-3 text-left text-body font-semibold text-ink">
                      {ticket.requestText}
                    </th>
                    <td className="px-3 py-3 text-caption text-ink-2">
                      {ticket.resolutionSummary ?? 'En curso'}
                    </td>
                    <td className="px-3 py-3 text-caption text-ink-2">
                      {ticket.toolsUsed.length > 0 ? ticket.toolsUsed.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-body text-ink">
                      {cents(ticket.costCents)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={ticket.resultStatus === 'completed' ? 'success' : 'warning'}>
                        {ticket.resultStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : null}
        </Card>
      ) : null}

      {tab === 'consumo' && canSeeUsage ? (
        <div className="space-y-4">
          {usage.isPending ? <LoadingSkeleton label="Cargando consumo…" rows={2} /> : null}
          {usage.error ? <Alert tone="error">{usage.error.message}</Alert> : null}
          {usage.data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardLabel>Solicitudes</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-ink">{usage.data.totals.requests}</p>
                </Card>
                <Card>
                  <CardLabel>Costo</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-ink">
                    {cents(usage.data.totals.listCostCents)}
                  </p>
                </Card>
                <Card>
                  <CardLabel>Tokens de entrada</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-ink">
                    {usage.data.totals.inputTokens.toLocaleString('es-CO')}
                  </p>
                </Card>
                <Card>
                  <CardLabel>Tiempo activo</CardLabel>
                  <p className="mt-2 font-mono text-title font-bold text-ink">
                    {Number(usage.data.totals.activeSeconds).toFixed(1)} s
                  </p>
                </Card>
              </div>
              <Card>
                <CardLabel>Detalle por turno</CardLabel>
                <DataTable minWidth="60rem" label="Consumo del asistente">
                  <thead className="border-b border-line bg-surface-2/60 text-caption text-ink-2 uppercase">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left">
                        Fecha
                      </th>
                      <th scope="col" className="px-3 py-3 text-left">
                        Usuario
                      </th>
                      <th scope="col" className="px-3 py-3 text-left">
                        Operación
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Entrada
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Salida
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Costo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {usage.data.data.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-3 font-mono text-caption text-ink-2">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-body text-ink">{row.userName}</td>
                        <td className="px-3 py-3 text-caption text-ink-2">{row.operation ?? '—'}</td>
                        <td className="px-3 py-3 text-right font-mono text-ink-2">{row.inputTokens}</td>
                        <td className="px-3 py-3 text-right font-mono text-ink-2">{row.outputTokens}</td>
                        <td className="px-3 py-3 text-right font-mono text-ink">
                          {cents(row.listCostCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'configuracion' && canManage ? (
        settings.data ? (
          <AssistantSettingsForm settings={settings.data} />
        ) : null
      ) : null}
    </section>
  );
}

function AssistantSettingsForm({ settings }: { settings: AssistantSettings }) {
  const update = useUpdateAssistantSettings();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [session, setSession] = useState((settings.settings.sessionBudgetCents / 100).toFixed(2));
  const [daily, setDaily] = useState((settings.settings.dailyCapCents / 100).toFixed(2));
  const [weekly, setWeekly] = useState((settings.settings.weeklyCapCents / 100).toFixed(2));
  const [monthly, setMonthly] = useState((settings.settings.monthlyCapCents / 100).toFixed(2));
  const [message, setMessage] = useState<string | null>(null);

  const save = () => {
    setMessage(null);
    update.mutate(
      {
        enabled,
        settings: {
          sessionBudgetCents: Math.round(Number(session) * 100),
          dailyCapCents: Math.round(Number(daily) * 100),
          weeklyCapCents: Math.round(Number(weekly) * 100),
          monthlyCapCents: Math.round(Number(monthly) * 100),
          alertPct: [80, 100],
          maxToolCallsPerTurn: 6,
          turnTimeoutSeconds: 60,
          messagesPerTenMinutes: 30,
        },
      },
      {
        onSuccess: (result) => {
          setMessage(result.data.enabled ? 'Asistente activado.' : 'Asistente desactivado.');
        },
        onError: (error) => {
          setMessage(error.message);
        },
      },
    );
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <Bot aria-hidden className="size-4" />
        </span>
        <div>
          <CardLabel>Configuración global</CardLabel>
          <p className="mt-1 text-caption text-ink-2">
            El asistente está apagado por defecto. Actívalo cuando las credenciales del agente estén
            configuradas.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        <CheckboxField
          label="Asistente activo"
          checked={enabled}
          hint={
            settings.configured
              ? 'Las credenciales del agente están configuradas.'
              : 'Faltan ANTHROPIC_API_KEY, ANTHROPIC_AGENT_ID o ANTHROPIC_ENVIRONMENT_ID.'
          }
          onChange={setEnabled}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField
            label="Presupuesto por sesión (USD)"
            type="number"
            min="0"
            step="0.01"
            value={session}
            onChange={(event) => {
              setSession(event.target.value);
            }}
          />
          <TextField
            label="Techo diario (USD)"
            type="number"
            min="0"
            step="0.01"
            value={daily}
            onChange={(event) => {
              setDaily(event.target.value);
            }}
          />
          <TextField
            label="Techo semanal (USD)"
            type="number"
            min="0"
            step="0.01"
            value={weekly}
            onChange={(event) => {
              setWeekly(event.target.value);
            }}
          />
          <TextField
            label="Techo mensual (USD)"
            type="number"
            min="0"
            step="0.01"
            value={monthly}
            onChange={(event) => {
              setMonthly(event.target.value);
            }}
          />
        </div>
        {message ? <Alert tone={update.isError ? 'error' : 'success'}>{message}</Alert> : null}
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </Card>
  );
}
