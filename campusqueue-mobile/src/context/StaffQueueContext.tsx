import { useQueue } from './QueueContext';
import {
  DeskStatus,
  ProcessedTransaction,
  StaffAccountRecord,
  StaffQueueTicket,
  StaffRegistrarDataBundle,
} from '../types/staff';

export interface StaffQueueContextValue {
  activeStaff: StaffAccountRecord;
  deskConfig: StaffRegistrarDataBundle['desk'];
  scannerConfig: StaffRegistrarDataBundle['scanner'];
  logsConfig: StaffRegistrarDataBundle['logs'];
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
  setCounterWindow: (windowLabel: string) => void;
  setDeskStatus: (status: DeskStatus) => void;
  callNext: () => StaffQueueTicket | null;
  completeCurrent: (
    advance: boolean,
    remarks?: string
  ) => { completedNumber?: string; nextTicket?: StaffQueueTicket };
  sendRecall: () => number;
  skipCurrent: (reason?: string) => {
    skippedNumber?: string;
    nextTicket?: StaffQueueTicket;
  };
  markTicketVerified: (ticketNumber: string) => void;
}

/**
 * Facade hook exposing synchronized Registrar Staff state backed by the root QueueContext.
 */
export function useStaffQueue(): StaffQueueContextValue {
  const queue = useQueue();

  return {
    activeStaff: queue.activeStaff,
    deskConfig: queue.deskConfig,
    scannerConfig: queue.scannerConfig,
    logsConfig: queue.logsConfig,
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
    setCounterWindow: queue.setStaffCounterWindow,
    setDeskStatus: queue.setStaffDeskStatus,
    callNext: queue.staffCallNext,
    completeCurrent: queue.staffCompleteCurrent,
    sendRecall: queue.staffSendRecall,
    skipCurrent: queue.staffSkipCurrent,
    markTicketVerified: queue.staffMarkTicketVerified,
  };
}
