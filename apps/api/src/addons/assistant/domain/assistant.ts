/** Reglas puras del asistente: presupuesto, propuestas y tickets (DEC-106). */

export type BudgetWindow = 'session' | 'daily' | 'weekly' | 'monthly';

export interface BudgetLimits {
  sessionCents: number;
  dailyCents: number;
  weeklyCents: number;
  monthlyCents: number;
}

export interface BudgetSpent {
  sessionCents: number;
  dailyCents: number;
  weeklyCents: number;
  monthlyCents: number;
}

/** Devuelve la ventana que se agotó primero, o null si hay margen. */
export function budgetExceeded(spent: BudgetSpent, limits: BudgetLimits): BudgetWindow | null {
  if (limits.sessionCents > 0 && spent.sessionCents >= limits.sessionCents) return 'session';
  if (limits.dailyCents > 0 && spent.dailyCents >= limits.dailyCents) return 'daily';
  if (limits.weeklyCents > 0 && spent.weeklyCents >= limits.weeklyCents) return 'weekly';
  if (limits.monthlyCents > 0 && spent.monthlyCents >= limits.monthlyCents) return 'monthly';
  return null;
}

export type ProposalStatus =
  'draft' | 'pending_confirmation' | 'confirmed' | 'executed' | 'cancelled' | 'expired' | 'failed';

/** Una propuesta se puede confirmar solo si está pendiente, no expiró y el hash coincide. */
export function canConfirmProposal(input: {
  status: ProposalStatus;
  expiresAt: Date;
  now: Date;
  argumentsHash: string;
  expectedHash: string;
}): { ok: true } | { ok: false; reason: 'not_pending' | 'expired' | 'stale' } {
  if (input.status !== 'pending_confirmation') return { ok: false, reason: 'not_pending' };
  if (input.expiresAt.getTime() <= input.now.getTime()) return { ok: false, reason: 'expired' };
  if (input.argumentsHash !== input.expectedHash) return { ok: false, reason: 'stale' };
  return { ok: true };
}

/** Resumen legible de una propuesta de materia prima. */
export function rawMaterialSummary(input: { name: string; unit: string; tracksExpiry: boolean }): string {
  return `Crear materia prima “${input.name}” en ${input.unit}${
    input.tracksExpiry ? ' con control de vencimiento' : ' sin control de vencimiento'
  }.`;
}

/** Resumen legible de una propuesta de receta inicial. */
export function recipeSummary(input: {
  productName: string;
  baseOutputQty: string;
  lines: { rawMaterialName: string; quantity: string; unit: string }[];
}): string {
  const ingredients = input.lines
    .map((line) => `${line.rawMaterialName} ${line.quantity} ${line.unit}`)
    .join(', ');
  return `Crear receta de “${input.productName}” con salida base ${input.baseOutputQty} y estos ingredientes: ${ingredients}.`;
}
