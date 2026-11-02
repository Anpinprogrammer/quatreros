import { formatDateTime, formatMoney } from './format';
import { usePrices } from './api';

/** Histórico de precios de una presentación (RF-032). */
export function PriceHistory({ presentationId }: { presentationId: string }) {
  const prices = usePrices(presentationId);

  if (prices.isPending) return <p className="mt-3 text-caption text-ink-2">Cargando histórico…</p>;
  if (prices.error) return <p className="mt-3 text-caption text-danger">{prices.error.message}</p>;
  if (prices.data.length === 0) {
    return <p className="mt-3 text-caption text-ink-2">Todavía no hay precios registrados.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-body">
        <caption className="sr-only">Histórico de precios de la presentación</caption>
        <thead className="border-b border-line bg-surface-2/60 text-caption tracking-[0.08em] text-ink-2 uppercase">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Precio
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Desde
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Hasta
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {prices.data.map((entry) => (
            <tr key={entry.id}>
              <td className="tabular px-3 py-2 font-mono whitespace-nowrap">{formatMoney(entry.price)}</td>
              <td className="px-3 py-2 text-ink-2">{formatDateTime(entry.validFrom)}</td>
              <td className="px-3 py-2">
                {entry.validTo ? (
                  <span className="text-ink-2">{formatDateTime(entry.validTo)}</span>
                ) : (
                  <span className="font-semibold text-success">Vigente</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-ink-3">Montos en pesos colombianos (COP).</p>
    </div>
  );
}
