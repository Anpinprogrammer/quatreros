import { LOT_STATUS_LABELS, type LotStatus } from '@quatreros/contracts';
import { Badge, type BadgeTone } from '../ui/Badge';

const tones: Record<LotStatus, BadgeTone> = {
  available: 'success',
  in_inspection: 'info',
  blocked: 'warning',
  expired: 'danger',
  written_off: 'neutral',
};

/** Estado del lote; un vencimiento pasado manda sobre el estado guardado. */
export function LotStatusBadge({ status, isExpired = false }: { status: LotStatus; isExpired?: boolean }) {
  const effective: LotStatus = isExpired && status !== 'written_off' ? 'expired' : status;
  return <Badge tone={tones[effective]}>{LOT_STATUS_LABELS[effective]}</Badge>;
}
