import { MOVEMENT_TYPE_LABELS, type StockMovementView } from '@quatreros/contracts';
import { Link } from 'react-router';
import { DataTable } from '../../shared/ui/DataTable';
import { formatDateTime, formatQuantity, formatSignedQuantity } from './format';

const SOURCE_LABELS: Record<string, string> = {
  'migration.opening_balance': 'Carga inicial',
  'inventory.transfer': 'Traslado',
  'purchasing.receipt': 'Recepción',
  'production.order': 'Producción',
  'pos.sale': 'Venta',
  'distribution.dispatch': 'Despacho',
};

/** Kardex cronológico con documento de origen (RF-111). */
export function MovementTable({
  movements,
  showLotLink = true,
}: {
  movements: StockMovementView[];
  showLotLink?: boolean;
}) {
  return (
    <DataTable minWidth="72rem">
      <caption className="sr-only">Movimientos de inventario, del más reciente al más antiguo</caption>
      <thead className="border-b border-line text-caption tracking-wider text-ink-2 uppercase">
        <tr>
          <th scope="col" className="px-3 py-3 font-semibold">
            Fecha
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Tipo
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Lote
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Ítem
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Ubicación
          </th>
          <th scope="col" className="px-3 py-3 text-right font-semibold">
            Cantidad
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Origen
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Usuario
          </th>
        </tr>
      </thead>
      <tbody>
        {movements.map((movement) => {
          const negative = Number(movement.quantity) < 0;
          return (
            <tr key={movement.id} className="border-b border-line last:border-0">
              <td className="px-3 py-3 whitespace-nowrap text-ink-2">{formatDateTime(movement.createdAt)}</td>
              <td className="px-3 py-3">{MOVEMENT_TYPE_LABELS[movement.movementType]}</td>
              <td className="px-3 py-3">
                {showLotLink ? (
                  <Link
                    to={`/erp/existencias/lotes/${movement.lotId}`}
                    className="font-mono text-brand-ink hover:text-ink"
                  >
                    {movement.lotCode}
                  </Link>
                ) : (
                  <span className="font-mono">{movement.lotCode}</span>
                )}
              </td>
              <td className="px-3 py-3">
                <span className="block">{movement.itemName}</span>
                <span className="text-caption text-ink-2">
                  {movement.presentationName ?? 'Materia prima'}
                </span>
              </td>
              <td className="px-3 py-3">
                <span className="block">{movement.locationName}</span>
                <span className="text-caption text-ink-2">{movement.siteName}</span>
              </td>
              <td
                className={`px-3 py-3 text-right font-mono whitespace-nowrap tabular-nums ${negative ? 'text-danger' : 'text-success'}`}
              >
                <span className="block">{formatSignedQuantity(movement.quantity)}</span>
                <span className="text-caption text-ink-2">
                  {formatQuantity(movement.baseQuantity)} {movement.baseUnit}
                </span>
              </td>
              <td className="px-3 py-3" title={movement.sourceId}>
                {SOURCE_LABELS[movement.sourceType] ?? movement.sourceType}
              </td>
              <td className="px-3 py-3 text-ink-2">{movement.createdByName ?? 'Sistema'}</td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
