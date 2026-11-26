import type { ActiveTicket, Office } from '../types/queue';

/**
 * Wait-time rules per office type:
 * - Accounting / Cashier: 3 minutes per student in queue
 * - Registrar: 5 minutes per student in queue
 * Wait estimates never drop below 0 minutes.
 */
export const ACCOUNTING_MINUTES_PER_STUDENT = 3;
export const REGISTRAR_MINUTES_PER_STUDENT = 5;
export const DEFAULT_MINUTES_PER_STUDENT = 4;

export function getOfficeMinutesPerStudent(
  officeId?: string | null,
  officeName?: string | null
): number | null {
  const id = (officeId ?? '').trim().toLowerCase();
  const name = (officeName ?? '').trim().toLowerCase();

  if (
    id === 'accounting' ||
    id === 'cashier' ||
    id.includes('accounting') ||
    id.includes('cashier') ||
    name.includes('accounting') ||
    name.includes('cashier')
  ) {
    return ACCOUNTING_MINUTES_PER_STUDENT;
  }

  if (id === 'registrar' || id.includes('registrar') || name.includes('registrar')) {
    return REGISTRAR_MINUTES_PER_STUDENT;
  }

  return null;
}

export function hasActiveNowServing(nowServing?: string | null): boolean {
  if (!nowServing) return false;
  const trimmed = nowServing.trim();
  return trimmed.length > 0 && trimmed !== 'â€”' && trimmed !== '-';
}

export function calculateEstimatedWaitMinutes(params: {
  officeId?: string | null;
  officeName?: string | null;
  peopleAhead: number;
  fallbackMinutesPerStudent?: number;
  backendEstimate?: number | null;
}): number {
  const safeAhead = Math.max(0, Math.floor(params.peopleAhead || 0));
  if (safeAhead === 0) return 0;

  const fixedRate = getOfficeMinutesPerStudent(params.officeId, params.officeName);
  if (fixedRate !== null) {
    return Math.max(0, safeAhead * fixedRate);
  }

  if (
    typeof params.backendEstimate === 'number' &&
    Number.isFinite(params.backendEstimate) &&
    params.backendEstimate >= 0
  ) {
    return Math.max(0, Math.round(params.backendEstimate));
  }

  const rate =
    params.fallbackMinutesPerStudent && params.fallbackMinutesPerStudent > 0
      ? params.fallbackMinutesPerStudent
      : DEFAULT_MINUTES_PER_STUDENT;
  return Math.max(0, Math.round(safeAhead * rate));
}

export function getAverageServiceDuration(office?: Pick<Office, 'services'> | null): number {
  const services = office?.services ?? [];
  if (services.length === 0) return DEFAULT_MINUTES_PER_STUDENT;
  const validDurations = services
    .map((s) => s.duration)
    .filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d > 0);
  if (validDurations.length === 0) return DEFAULT_MINUTES_PER_STUDENT;
  return Math.round(validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length);
}

export function computeOfficeEstimatedWaitMins(
  office: Pick<Office, 'id' | 'name' | 'waitingCount' | 'nowServing' | 'services'>
): number {
  const waiting = Math.max(0, office.waitingCount ?? 0);
  const servingOffset = hasActiveNowServing(office.nowServing) ? 1 : 0;
  const totalInLine = waiting + servingOffset;
  return calculateEstimatedWaitMinutes({
    officeId: office.id,
    officeName: office.name,
    peopleAhead: totalInLine,
    fallbackMinutesPerStudent: getAverageServiceDuration(office),
  });
}

export function formatOfficeCrowdBadge(
  office: Pick<Office, 'id' | 'name' | 'waitingCount' | 'nowServing' | 'services' | 'acceptingTickets'>
): string {
  if (office.acceptingTickets === false) {
    return 'Closed';
  }
  const waiting = Math.max(0, office.waitingCount ?? 0);
  const estMins = computeOfficeEstimatedWaitMins(office);
  if (waiting === 0 && !hasActiveNowServing(office.nowServing)) {
    return 'Queue clear';
  }
  if (waiting === 0) {
    return `Serving â€¢ ~${estMins}m`;
  }
  return `${waiting} waiting â€¢ ~${estMins}m`;
}

