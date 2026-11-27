import { useQueue } from './QueueContext';
import {
  DeskStatus,
  LogFilterTab,
  ProcessedTransaction,
  StaffAccountRecord,
  StaffCounterOption,
  StaffQueueTicket,
} from '../types/staff';

export interface StaffQueueContextValue {
  activeStaff: StaffAccountRecord;
  counters: StaffCounterOption[];
  officeServices: string[];
  logFilters: LogFilterTab[];
  averageServiceLabel: string;
  counterWindow: string;
  deskStatus: DeskStatus;
  servingTicket: StaffQueueTicket | null;
  waitingQueue: StaffQueueTicket[];
  elapsedSeconds: number;
  recallCount: number;
  transactions: ProcessedTransaction[];
  servedByMeCount: number;
  officeCompletedCount: number;
  skippedCount: number;
  isSyncing: boolean;
  isMutating: boolean;
  hasLoaded: boolean;
  syncError: string | null;
  refreshDesk: (includeLogs?: boolean, silent?: boolean) => Promise<void>;
  setCounterWindow: (windowLabel: string) => void;
  setDeskStatus: (status: DeskStatus) => void;
  callNext: ReturnType<typeof useQueue>['staffCallNext'];
  startService: ReturnType<typeof useQueue>['staffStartService'];
  completeCurrent: ReturnType<typeof useQueue>['staffCompleteCurrent'];
  sendRecall: ReturnType<typeof useQueue>['staffSendRecall'];
  skipCurrent: ReturnType<typeof useQueue>['staffSkipCurrent'];
  requeueTicket: ReturnType<typeof useQueue>['staffRequeueTicket'];
  downloadShiftReport: ReturnType<typeof useQueue>['downloadStaffShiftReport'];
}

/**
 * Facade hook exposing synchronized live multi-office Staff state backed by QueueContext.
 */
export function useStaffQueue(): StaffQueueContextValue {
  const queue = useQueue();

  return {
    activeStaff: queue.activeStaff,
    counters: queue.staffCounters,
    officeServices: queue.staffOfficeServices,
    logFilters: queue.staffLogFilters,
    averageServiceLabel: queue.staffAverageServiceLabel,
    counterWindow: queue.staffCounterWindow,
    deskStatus: queue.staffDeskStatus,
    servingTicket: queue.staffServingTicket,
    waitingQueue: queue.staffWaitingQueue,
    elapsedSeconds: queue.staffElapsedSeconds,
    recallCount: queue.staffRecallCount,
    transactions: queue.staffTransactions,
    servedByMeCount: queue.staffServedByMeCount,
    officeCompletedCount: queue.staffOfficeCompletedCount,
    skippedCount: queue.staffSkippedCount,
    isSyncing: queue.isSyncingLive,
    isMutating: queue.isMutatingLive,
    hasLoaded: queue.hasLoadedLive,
    syncError: queue.liveSyncError,
    refreshDesk: queue.refreshLiveQueue,
    setCounterWindow: queue.setStaffCounterWindow,
    setDeskStatus: queue.setStaffDeskStatus,
    callNext: queue.staffCallNext,
    startService: queue.staffStartService,
    completeCurrent: queue.staffCompleteCurrent,
    sendRecall: queue.staffSendRecall,
    skipCurrent: queue.staffSkipCurrent,
    requeueTicket: queue.staffRequeueTicket,
    downloadShiftReport: queue.downloadStaffShiftReport,
  };
}
