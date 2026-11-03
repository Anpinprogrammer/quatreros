import { CreditCard } from 'lucide-react';
import { Link } from 'react-router';
import { formatMoney } from '../../lib/format/pos';
import { useFinanceDashboard } from '../../services/finance';

/** Tarjeta del Command Center con cartera y recaudos reales. */
export function FinanceSummaryCard() {
  const dashboard = useFinanceDashboard();
  const data = dashboard.data;
  return (
    <Link
      to="/erp/cartera"
      className="rounded-lg border border-line bg-surface-2/50 px-2 py-1.5 transition-colors hover:border-brand/40 hover:bg-surface-2"
      title="Abrir cartera y recaudos"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
        <CreditCard aria-hidden className="size-3.5 shrink-0 text-ink-3" />
        <span className="truncate">Crédito y cartera</span>
      </p>
      <p className="mt-0.5 pl-5 text-[10px] text-ink-3">
        {data
          ? `${formatMoney(data.receivables.overdue)} vencido · ${String(data.collections.pendingCount)} recaudos`
          : dashboard.error
            ? 'Sin acceso'
            : 'Consultando…'}
      </p>
    </Link>
  );
}
