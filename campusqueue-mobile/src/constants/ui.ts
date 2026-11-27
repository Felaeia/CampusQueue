import type { HistoryFilterOption } from '../types/queue';
import type { LogFilterTab } from '../types/staff';

export const MIN_PASSWORD_LENGTH = 8;

export const CANCEL_REASONS: string[] = [
  'No longer needed',
  'Long wait time',
  'Wrong office or service selected',
  'Will return later',
];

export const HISTORY_FILTERS: HistoryFilterOption[] = [
  'All',
  'Completed',
  'Skipped',
  'Cancelled',
];

export const STAFF_LOG_FILTERS: LogFilterTab[] = [
  'My Counter Only',
  'All Office Counters',
  'Skipped Only',
];

export const DEFAULT_BARCODE_WIDTHS: number[] = [
  2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 2, 3, 1, 2, 1, 2, 2, 1, 3, 2, 1, 2, 1,
];
