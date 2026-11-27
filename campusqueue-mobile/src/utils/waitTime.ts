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
  return trimmed.length > 0 && trimmed !== '—' && trimmed !== '-';
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
    return `Serving • ~${estMins}m`;
  }
  return `${waiting} waiting • ~${estMins}m`;
}

export function isTicketCalledOrServing(
  ticket?: Pick<ActiveTicket, 'status' | 'lifecycleStatus'> | null
): boolean {
  if (!ticket) return false;
  return (
    ticket.lifecycleStatus === 'called' ||
    ticket.lifecycleStatus === 'serving' ||
    ticket.status === 'serving'
  );
}

/**
 * Normalizes a live ticket returned by `GET /api/student` so position and wait
 * time reflect both waiting students ahead and any student currently being served.
 */
export function normalizeActiveTicket(
  ticket: ActiveTicket,
  office?: Office | null
): ActiveTicket {
  const serving = isTicketCalledOrServing(ticket);
  const nowServing = ticket.nowServing || office?.nowServing || '';
  const rawAhead = Math.max(0, ticket.aheadCount ?? 0);

  if (serving) {
    return {
      ...ticket,
      status: 'serving',
      aheadCount: 0,
      estWaitMins: 0,
      nowServing: nowServing || ticket.ticketNumber,
      trackNodes: [],
    };
  }

  const effectiveAhead = rawAhead + (hasActiveNowServing(nowServing) ? 1 : 0);
  const matchedService = office?.services.find(
    (s) => (ticket.serviceId && s.id === ticket.serviceId) || s.name === ticket.service
  );
  const estWaitMins = calculateEstimatedWaitMinutes({
    officeId: ticket.officeId,
    officeName: ticket.officeName || office?.name,
    peopleAhead: effectiveAhead,
    fallbackMinutesPerStudent: matchedService?.duration ?? getAverageServiceDuration(office),
    backendEstimate: ticket.estWaitMins,
  });

  const trackNodes =
    Array.isArray(ticket.trackNodes) && ticket.trackNodes.length > 0
      ? ticket.trackNodes
      : effectiveAhead > 1
        ? Array.from({ length: Math.min(2, effectiveAhead - 1) }, (_, idx) => `#${idx + 1}`)
        : [];

  return {
    ...ticket,
    status: 'waiting',
    aheadCount: effectiveAhead,
    estWaitMins,
    nowServing,
    trackNodes,
    shortOffice: ticket.shortOffice || office?.shortLabel || ticket.officeName.replace(' Office', ''),
    counter: ticket.counter || office?.windowLabel || 'Counter',
  };
}

export function computeStaffWaitingEstimateMins(
  indexInWaitingQueue: number,
  hasServingTicket: boolean,
  officeId?: string | null,
  officeName?: string | null,
  fallbackDuration?: number
): number {
  const peopleAhead = Math.max(0, indexInWaitingQueue) + (hasServingTicket ? 1 : 0);
  return calculateEstimatedWaitMinutes({
    officeId,
    officeName,
    peopleAhead,
    fallbackMinutesPerStudent: fallbackDuration,
  });
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function formatDisplayTimestamp(
  value?: string | null,
  mode: 'time' | 'short' | 'datetime' = 'short'
): string {
  if (!value || !value.trim()) return '—';
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return trimmed;

  const date = new Date(trimmed);
  if (!Number.isFinite(date.valueOf())) return trimmed;

  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  if (mode === 'time') return timePart;

  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
  if (mode === 'short') return `${datePart} • ${timePart}`;

  const fullDatePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
  return `${fullDatePart} • ${timePart}`;
}

export function manilaDateString(offsetDays = 0): string {
  const manilaMs = Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 86_400_000;
  return new Date(manilaMs).toISOString().slice(0, 10);
}
