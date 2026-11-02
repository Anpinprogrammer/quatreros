import { Alert } from '../../shared/ui/form';
import { usePrices } from './api';
import { formatDateTime, formatMoney } from './format';

/** RF-032: histórico de precios, más reciente primero. */
export function PriceHistory({ presentationId }: { presentationId: string }) {
  const prices = usePrices(presentationId);

  if (prices.isPending) return <p className="mt-3 text-ash">Cargando histórico…</p>;
  if (prices.error) {
    return (
      <div className="mt-3">
        <Alert>{prices.error.message}</Alert>
      </div>
    );
  }
  if (prices.data.length === 0) {
    return <p className="mt-3 text-ash">Todavía no hay precios registrados.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-body">
        <caption className="sr-only">Histórico de precios de la presentación</caption>
        <thead className="border-b border-grill text-caption tracking-wider text-ash uppercase">
          <tr>
            <th scope="col" className="px-2 py-2 font-semibold">
              Precio
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              Desde
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              Hasta
            </th>
          </tr>
        </thead>
        <tbody>
          {prices.data.map((entry) => (
            <tr key={entry.id} className="border-b border-grill last:border-0">
              <td className="px-2 py-2 font-mono whitespace-nowrap">{formatMoney(entry.price)}</td>
              <td className="px-2 py-2 text-ash">{formatDateTime(entry.validFrom)}</td>
              <td className="px-2 py-2">
                {entry.validTo ? (
                  <span className="text-ash">{formatDateTime(entry.validTo)}</span>
                ) : (
                  <span className="font-semibold text-success">Vigente</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
