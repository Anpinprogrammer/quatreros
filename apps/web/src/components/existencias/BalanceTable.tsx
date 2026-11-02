import { ITEM_KIND_LABELS, type StockBalanceView } from '@quatreros/contracts';
import { Link } from 'react-router';
import { DataTable } from '../ui/DataTable';
import { formatDate, formatQuantity } from '../../lib/format/existencias';
import { LotStatusBadge } from './StatusBadge';

/** Saldos por lote, presentación y ubicación (RF-110). */
export function BalanceTable({
  balances,
  showLotLink = true,
}: {
  balances: StockBalanceView[];
  showLotLink?: boolean;
}) {
  return (
    <DataTable minWidth="64rem">
      <caption className="sr-only">Saldos por lote, presentación y ubicación</caption>
      <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
        <tr>
          <th scope="col" className="px-3 py-3 font-semibold">
            Ítem
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Presentación
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Lote
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Ubicación
          </th>
          <th scope="col" className="px-3 py-3 text-right font-semibold">
            Cantidad
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Vence
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Estado
          </th>
        </tr>
      </thead>
      <tbody>
        {balances.map((balance) => (
          <tr
            key={`${balance.lotId}-${balance.presentationId ?? 'mp'}-${balance.locationId}`}
            className="border-b border-line last:border-0"
          >
            <th scope="row" className="px-3 py-3 font-normal">
              <span className="block font-semibold text-ink">{balance.itemName}</span>
              <span className="text-caption text-ink-2">{ITEM_KIND_LABELS[balance.itemKind]}</span>
            </th>
            <td className="px-3 py-3">{balance.presentationName ?? '—'}</td>
            <td className="px-3 py-3">
              {showLotLink ? (
                <Link
                  to={`/erp/existencias/lotes/${balance.lotId}`}
                  className="font-mono text-brand-ink hover:text-ink"
                >
                  {balance.lotCode}
                </Link>
              ) : (
                <span className="font-mono">{balance.lotCode}</span>
              )}
            </td>
            <td className="px-3 py-3">
              <span className="block">{balance.locationName}</span>
              <span className="text-caption text-ink-2">{balance.siteName}</span>
            </td>
            <td className="px-3 py-3 text-right font-mono whitespace-nowrap tabular-nums">
              {formatQuantity(balance.quantity)}{' '}
              <span className="text-caption text-ink-2">{balance.baseUnit}</span>
            </td>
            <td
              className={`px-3 py-3 whitespace-nowrap ${balance.isExpired ? 'font-semibold text-danger' : 'text-ink-2'}`}
            >
              {formatDate(balance.expiresOn)}
            </td>
            <td className="px-3 py-3">
              <LotStatusBadge status={balance.lotStatus} isExpired={balance.isExpired} />
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
